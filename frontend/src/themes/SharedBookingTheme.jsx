import React, { useEffect, useState } from 'react';
import styles from './SharedBookingTheme.module.css';
import { api } from '../api';

function generateICS(serviceName, date, time, tenantName, location) {
  const [h, m] = time.split(':').map(Number);
  const [yr, mo, da] = date.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const dtStart = `${yr}${pad(mo)}${pad(da)}T${pad(h)}${pad(m)}00`;
  const dtEnd = `${yr}${pad(mo)}${pad(da)}T${pad(h + 1)}${pad(m)}00`;
  const uid = `${Date.now()}@icssbookings.com`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICSS Bookings//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${serviceName} @ ${tenantName}`,
    `LOCATION:${location || tenantName}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointment.ics';
  a.click();
  URL.revokeObjectURL(url);
}

function googleCalUrl(serviceName, date, time, tenantName, location) {
  const [h, m] = time.split(':').map(Number);
  const [yr, mo, da] = date.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const dtStart = `${yr}${pad(mo)}${pad(da)}T${pad(h)}${pad(m)}00`;
  const dtEnd = `${yr}${pad(mo)}${pad(da)}T${pad(h + 1)}${pad(m)}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${serviceName} @ ${tenantName}`,
    dates: `${dtStart}/${dtEnd}`,
    location: location || tenantName,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function defaultPriceFormatter(service) {
  if (!service) return '$0';
  if (Number(service.price) === 0) return 'Free';
  return `$${Number(service.price).toLocaleString()}`;
}

function formatDisplayDate(dateString) {
  if (!dateString) return 'Choose a date';
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDisplayTime(timeString) {
  if (!timeString) return 'Choose a time';
  const [hour, minute] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(minutes) {
  const totalMinutes = Number(minutes || 0);
  if (totalMinutes <= 0) return '0 min';

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const parts = [];

  if (hours > 0) parts.push(`${hours} hr${hours === 1 ? '' : 's'}`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} min`);

  return parts.join(' ');
}

function formatCurrency(amount, currency = 'JMD') {
  const numericAmount = Number(amount || 0);
  if (numericAmount === 0) return 'Free';
  return `${currency} ${numericAmount.toLocaleString()}`;
}

function calculateRequiredAmount(service) {
  const servicePrice = Math.max(0, Number(service?.price || 0));
  const requirement = service?.payment_requirement_type || 'none';

  if (requirement === 'deposit') {
    const rawAmount = service?.deposit_type === 'percentage'
      ? servicePrice * (Math.max(0, Number(service?.deposit_amount || 0)) / 100)
      : Math.max(0, Number(service?.deposit_amount || 0));
    return Math.min(servicePrice, rawAmount);
  }

  if (requirement === 'full') {
    return servicePrice;
  }

  return 0;
}

function resolvePaymentDetails(service, tenant) {
  if (!service) {
    return {
      mode: 'none',
      requirement: 'none',
      dueToday: 0,
      collectNow: false,
      hasConfigurationIssue: false,
      summaryLabel: null,
      calloutTitle: null,
      calloutCopy: null,
      buttonLabel: 'Complete Booking',
      balanceLater: 0
    };
  }

  const requirement = service.payment_requirement_type || 'none';
  const rawMode = service.payment_mode && service.payment_mode !== 'tenant_default'
    ? service.payment_mode
    : (tenant.default_payment_mode || 'none');
  const dueToday = calculateRequiredAmount(service);
  const collectNow = dueToday > 0;
  const modeAvailable = rawMode === 'wipay'
    ? Boolean(tenant.wipay_enabled)
    : rawMode === 'manual'
      ? Boolean(tenant.manual_payment_enabled)
      : rawMode === 'none';
  const hasConfigurationIssue = collectNow && (!rawMode || rawMode === 'none' || !modeAvailable);
  const balanceLater = Math.max(0, Number(service.price || 0) - dueToday);

  let summaryLabel = null;
  let calloutTitle = null;
  let calloutCopy = null;
  let buttonLabel = 'Complete Booking';

  if (collectNow) {
    summaryLabel = requirement === 'deposit' ? 'Deposit due today' : 'Payment due today';

    if (rawMode === 'manual' && modeAvailable) {
      calloutTitle = requirement === 'deposit' ? 'Deposit required before confirmation' : 'Payment proof required before confirmation';
      calloutCopy = tenant.bank_transfer_instructions || 'Upload your transfer receipt to submit this booking for review.';
      buttonLabel = requirement === 'deposit' ? 'Submit Deposit' : 'Submit Payment Proof';
    } else if (rawMode === 'wipay' && modeAvailable) {
      calloutTitle = requirement === 'deposit' ? 'Deposit required to reserve this time' : 'Payment required to complete this booking';
      calloutCopy = 'You will be redirected to secure checkout after submitting your details.';
      buttonLabel = requirement === 'deposit' ? 'Pay Deposit' : 'Pay Now';
    } else {
      calloutTitle = 'Payment setup needed';
      calloutCopy = 'This service requires payment before booking, but the payment method is not available right now.';
      buttonLabel = 'Payment unavailable';
    }
  }

  return {
    mode: rawMode,
    requirement,
    dueToday,
    collectNow,
    hasConfigurationIssue,
    summaryLabel,
    calloutTitle,
    calloutCopy,
    buttonLabel,
    balanceLater
  };
}

function IconGlyph({ kind, className }) {
  const paths = {
    brand: 'M6 3.75A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25h12A2.25 2.25 0 0 0 20.25 18V9.31a2.25 2.25 0 0 0-.659-1.591l-3.31-3.31A2.25 2.25 0 0 0 14.69 3.75H6Zm3 3a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.75.75H9.75A.75.75 0 0 1 9 9V6.75Zm3 5.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z',
    service: 'M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 17.25V6.75Zm3 1.5a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Zm0 3.75a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Zm0 3.75a.75.75 0 0 0 0 1.5h5.25a.75.75 0 0 0 0-1.5H7.5Z',
    item: 'M12 3.75 14.52 8.85l5.63.82-4.08 3.98.96 5.61L12 16.61l-5.03 2.65.96-5.61-4.08-3.98 5.63-.82L12 3.75Z',
    location: 'M12 21s6-5.686 6-11.143C18 6.07 15.314 3.75 12 3.75S6 6.07 6 9.857C6 15.314 12 21 12 21Zm0-8.25a2.893 2.893 0 1 0 0-5.786 2.893 2.893 0 0 0 0 5.786Z',
    calendar: 'M7.5 3.75a.75.75 0 0 1 .75.75V6h6V4.5a.75.75 0 0 1 1.5 0V6h.75A2.25 2.25 0 0 1 19.5 8.25v9A2.25 2.25 0 0 1 17.25 19.5H6.75A2.25 2.25 0 0 1 4.5 17.25v-9A2.25 2.25 0 0 1 6.75 6h.75V4.5a.75.75 0 0 1 .75-.75Zm9.75 6H6v7.5a.75.75 0 0 0 .75.75h10.5a.75.75 0 0 0 .75-.75v-7.5Z',
    details: 'M12 3.75a4.125 4.125 0 1 1 0 8.25 4.125 4.125 0 0 1 0-8.25ZM5.25 18A5.25 5.25 0 0 1 10.5 12.75h3A5.25 5.25 0 0 1 18.75 18v.75H5.25V18Z',
    check: 'M16.28 8.97a.75.75 0 1 0-1.06-1.06l-4.47 4.47-1.97-1.97a.75.75 0 1 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5Z'
  };

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={paths[kind] || paths.service} />
    </svg>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
  });
}

function normalizeOptions(options, tenant) {
  const resolved = typeof options === 'function' ? options(tenant) : (options || []);
  return resolved
    .filter((option) => option && option.label)
    .map((option) => ({
      value: option.value ?? option.label,
      label: option.label
    }));
}

function buildThemeVars(palette) {
  return {
    '--theme-page-bg': palette.pageBg,
    '--theme-page-accent-a': palette.pageAccentA,
    '--theme-page-accent-b': palette.pageAccentB,
    '--theme-shell-bg': palette.shellBg,
    '--theme-shell-border': palette.shellBorder,
    '--theme-shell-shadow': palette.shellShadow,
    '--theme-panel-bg': palette.panelBg,
    '--theme-panel-border': palette.panelBorder,
    '--theme-panel-shadow': palette.panelShadow,
    '--theme-card-bg': palette.cardBg,
    '--theme-card-border': palette.cardBorder,
    '--theme-card-hover': palette.cardHover,
    '--theme-card-selected': palette.cardSelected,
    '--theme-card-selected-border': palette.cardSelectedBorder,
    '--theme-soft-bg': palette.softBg,
    '--theme-strong-bg': palette.strongBg,
    '--theme-strong-shadow': palette.strongShadow,
    '--theme-input-bg': palette.inputBg,
    '--theme-input-border': palette.inputBorder,
    '--theme-text-main': palette.textMain,
    '--theme-text-subtle': palette.textSubtle,
    '--theme-text-muted': palette.textMuted,
    '--theme-accent': palette.accent,
    '--theme-accent-strong': palette.accentStrong,
    '--theme-accent-soft': palette.accentSoft,
    '--theme-accent-border': palette.accentBorder,
    '--theme-button-text': palette.buttonText || '#ffffff',
  };
}

function defaultBuildNotes({ selectedOption, extraState, fields, addonItems }) {
  const lines = [];

  if (selectedOption?.noteLabel) {
    lines.push(`${selectedOption.noteLabel}: ${selectedOption.label}`);
  }

  fields.forEach((field) => {
    const value = extraState[field.name];
    if (!field.noteLabel || value === '' || value === null || value === undefined) return;
    lines.push(`${field.noteLabel}: ${value}`);
  });

  if (addonItems.length > 0) {
    lines.push(`Add-ons: ${addonItems.map((item) => item.name).join(', ')}`);
  }

  return lines.join('\n') || null;
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        required={field.required}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder || ''}
        rows={field.rows || 4}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select required={field.required} value={value} onChange={(e) => onChange(field.name, e.target.value)}>
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type || 'text'}
      required={field.required}
      value={value}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder || ''}
    />
  );
}

export default function SharedBookingTheme({ tenant, services, theme }) {
  const palette = {
    pageBg: '#f8f4f6',
    pageAccentA: 'rgba(166, 112, 130, 0.18)',
    pageAccentB: 'rgba(215, 198, 204, 0.2)',
    shellBg: 'rgba(255, 255, 255, 0.8)',
    shellBorder: 'rgba(77, 50, 61, 0.08)',
    shellShadow: '0 24px 50px rgba(53, 31, 40, 0.08)',
    panelBg: 'rgba(255, 255, 255, 0.94)',
    panelBorder: 'rgba(77, 50, 61, 0.08)',
    panelShadow: '0 18px 36px rgba(53, 31, 40, 0.05)',
    cardBg: '#ffffff',
    cardBorder: '#e7d8de',
    cardHover: 'rgba(166, 112, 130, 0.1)',
    cardSelected: 'linear-gradient(180deg, #fff8fa 0%, #f8edf2 100%)',
    cardSelectedBorder: 'rgba(139, 82, 104, 0.36)',
    softBg: 'rgba(166, 112, 130, 0.08)',
    strongBg: 'linear-gradient(180deg, #9f5e76 0%, #82485d 100%)',
    strongShadow: '0 16px 28px rgba(130, 72, 93, 0.24)',
    inputBg: '#ffffff',
    inputBorder: '#e7d8de',
    textMain: '#24161d',
    textSubtle: '#573745',
    textMuted: '#8d7280',
    accent: '#8b5268',
    accentStrong: '#724356',
    accentSoft: 'rgba(139, 82, 104, 0.12)',
    accentBorder: 'rgba(139, 82, 104, 0.18)',
    ...theme.palette
  };

  const optionConfig = theme.preferenceField
    ? { ...theme.preferenceField, options: normalizeOptions(theme.preferenceField.options, tenant) }
    : null;
  const resolvedFields = (theme.extraFields || []).map((field) => ({
    ...field,
    options: field.type === 'select' ? normalizeOptions(field.options, tenant) : field.options
  }));
  const addonItems = typeof theme.addons?.items === 'function' ? theme.addons.items(tenant) : (theme.addons?.items || []);

  const [selectedService, setSelectedService] = useState(services[0] || null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [selectedOption, setSelectedOption] = useState(optionConfig?.options?.[0] || null);
  const [selectedAddons, setSelectedAddons] = useState(new Set());
  const [extraState, setExtraState] = useState(() => Object.fromEntries(
    resolvedFields.map((field) => [field.name, field.defaultValue ?? (field.type === 'select' ? field.options?.[0]?.value || '' : '')])
  ));

  useEffect(() => {
    setSelectedService(services[0] || null);
  }, [services]);

  useEffect(() => {
    setSelectedOption(optionConfig?.options?.[0] || null);
  }, [optionConfig?.options]);

  useEffect(() => {
    setExtraState(Object.fromEntries(
      resolvedFields.map((field) => [field.name, field.defaultValue ?? (field.type === 'select' ? field.options?.[0]?.value || '' : '')])
    ));
  }, [tenant.slug, theme.name]);

  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setLoadingSlots(true);
    api.publicAvailability(tenant.slug, selectedDate, selectedService.id)
      .then((data) => setAvailability(((data.slots || []).filter((slot) => slot.available))))
      .catch((err) => {
        console.error('[Availability]', err.message);
        setAvailability([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [tenant.slug, selectedDate, selectedService]);

  const selectedAddonItems = addonItems.filter((item) => selectedAddons.has(item.id));
  const priceFormatter = theme.priceFormatter || defaultPriceFormatter;
  const baseTotal = selectedService ? Number(selectedService.price || 0) : 0;
  const addonsTotal = selectedAddonItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const totalAmount = theme.calculateTotal
    ? theme.calculateTotal({ selectedService, selectedAddonItems, addonItems, extraState })
    : baseTotal + addonsTotal;
  const paymentDetails = resolvePaymentDetails(selectedService, tenant);
  const needsReceipt = paymentDetails.collectNow && paymentDetails.mode === 'manual' && !paymentDetails.hasConfigurationIssue;

  const handleExtraFieldChange = (nameToSet, value) => {
    setExtraState((prev) => ({ ...prev, [nameToSet]: value }));
  };

  const toggleAddon = (addonId) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) next.delete(addonId);
      else next.add(addonId);
      return next;
    });
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedService) {
      alert(theme.emptyServicesText || 'No services are currently available.');
      return;
    }
    if (!selectedTime) {
      alert(theme.selectTimeAlert || 'Please select a time.');
      return;
    }
    if (needsReceipt && !receiptImage) {
      alert(theme.receiptRequiredAlert || 'Please attach your bank transfer receipt.');
      return;
    }

    let receiptBase64 = null;
    if (receiptImage) {
      receiptBase64 = await readFileAsDataUrl(receiptImage);
    }

    const notes = theme.buildNotes
      ? theme.buildNotes({
          tenant,
          selectedService,
          selectedDate,
          selectedTime,
          selectedOption,
          extraState,
          selectedAddonItems
        })
      : defaultBuildNotes({
          selectedOption,
          extraState,
          fields: resolvedFields,
          addonItems: selectedAddonItems
        });

    try {
      const res = await api.publicCreateBooking(tenant.slug, {
        service_id: selectedService.id,
        date: selectedDate,
        time: selectedTime,
        name,
        email,
        phone,
        notes,
        receipt_image: receiptBase64
      });

      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setConfirmModal({
          service: selectedService.name,
          date: selectedDate,
          time: selectedTime,
          status: res.booking?.status || 'confirmed',
          title: res.booking?.status === 'pending_manual_confirmation'
            ? (paymentDetails.requirement === 'deposit' ? 'Deposit Submitted' : 'Payment Submitted')
            : (theme.confirmationTitle || 'Booking Confirmed'),
          text: res.booking?.status === 'pending_manual_confirmation'
            ? 'Your booking is pending review. We will confirm it once your payment receipt is approved.'
            : (theme.confirmationText || 'A confirmation email is on its way with all of your appointment details.')
        });
      }
    } catch (err) {
      alert(err.message || 'Failed to complete booking.');
    }
  };

  const summaryRows = theme.summaryRows
    ? theme.summaryRows({
        selectedService,
        selectedDate,
        selectedTime,
        selectedOption,
        extraState,
        selectedAddonItems,
        totalAmount,
        priceFormatter
      })
    : [];

  return (
    <>
      <div className={styles.wrapper} style={buildThemeVars(palette)}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <div className={styles.brand}>
              <div className={styles.brandIcon}>
                {tenant.branding?.logoUrl
                  ? <img src={tenant.branding.logoUrl} alt={tenant.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  : <IconGlyph kind="brand" className={styles.iconGlyph} />}
              </div>
              <div className={styles.brandText}>
                <h1>{tenant.name}</h1>
                {tenant.branding?.bookingTagline && (
                  <p className={styles.brandTagline}>{tenant.branding.bookingTagline}</p>
                )}
                {tenant.branding?.location && (
                  <div className={styles.brandLocation}>
                    <IconGlyph kind="location" className={styles.inlineIcon} />
                    <span>{tenant.branding.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.headerActions}>
              {tenant.branding?.badge1 && <div className={styles.badge}>{tenant.branding.badge1}</div>}
              {tenant.branding?.badge2 && <div className={styles.badge}>{tenant.branding.badge2}</div>}
            </div>
          </div>

          <div className={styles.grid}>
            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderMedia}>
                  {tenant.branding?.serviceSectionImageUrl
                    ? <img src={tenant.branding.serviceSectionImageUrl} alt="" className={styles.sectionHeaderImage} />
                    : <IconGlyph kind="service" className={styles.iconGlyph} />}
                </div>
                <h2>{theme.serviceSectionTitle || 'Choose a Service'}</h2>
              </div>

              <div className={styles.serviceList}>
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className={`${styles.serviceCard} ${selectedService?.id === service.id ? styles.selected : ''}`}
                    onClick={() => setSelectedService(service)}
                  >
                    <div className={styles.serviceInfo}>
                      <div className={styles.serviceGlyph}>
                        {service.image_url
                          ? <img src={service.image_url} alt="" className={styles.serviceGlyphImage} />
                          : <IconGlyph kind="item" className={styles.iconGlyph} />}
                      </div>
                      <div className={styles.serviceText}>
                        <h3>{service.name}</h3>
                        <span>{formatDuration(service.duration_minutes)}</span>
                      </div>
                    </div>
                    <div className={styles.servicePrice}>{priceFormatter(service)}</div>
                  </button>
                ))}
                {services.length === 0 && <p className={styles.helperText}>{theme.emptyServicesText || 'No services are currently available.'}</p>}
              </div>

              {addonItems.length > 0 && (
                <div className={styles.block}>
                  <div className={styles.blockLabel}>{theme.addons?.title || 'Add-ons'}</div>
                  <div className={styles.addonGrid}>
                    {addonItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.addonCard} ${selectedAddons.has(item.id) ? styles.selected : ''}`}
                        onClick={() => toggleAddon(item.id)}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          {item.description && <span>{item.description}</span>}
                        </div>
                        <em>{item.price === 0 ? 'Included' : `$${Number(item.price).toLocaleString()}`}</em>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.block}>
                <div className={styles.blockLabel}>{theme.dateLabel || 'Choose your date'}</div>
                <div className={styles.inputShell}>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <IconGlyph kind="calendar" className={styles.inputIcon} />
                </div>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>{theme.timeLabel || 'Choose a time'}</div>
                {loadingSlots ? <p className={styles.helperText}>{theme.loadingSlotsText || 'Loading available times...'}</p> : (
                  <div className={styles.timeGrid}>
                    {availability.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        className={`${styles.timeChip} ${selectedTime === slot.time ? styles.selected : ''}`}
                        onClick={() => setSelectedTime(slot.time)}
                      >
                        {slot.label || slot.time}
                      </button>
                    ))}
                    {availability.length === 0 && <p className={styles.helperText}>{theme.noSlotsText || 'No slots available for this date.'}</p>}
                  </div>
                )}
              </div>

              {tenant.branding?.bookingFooterNote && (
                <div className={styles.bookingNote}>{tenant.branding.bookingFooterNote}</div>
              )}
            </section>

            <section className={`${styles.panel} ${styles.formPanel}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderMedia}>
                  <IconGlyph kind="details" className={styles.iconGlyph} />
                </div>
                <h2>{theme.detailsSectionTitle || 'Your Details'}</h2>
              </div>

              <form onSubmit={handleBooking}>
                <div className={styles.field}>
                  <label>Full name</label>
                  <div className={styles.inputShell}>
                    <input type="text" required placeholder={theme.namePlaceholder || 'e.g., Jordan Smith'} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Email address</label>
                  <div className={styles.inputShell}>
                    <input type="email" required placeholder={theme.emailPlaceholder || 'hello@example.com'} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Phone number</label>
                  <div className={styles.inputShell}>
                    <input type="tel" required placeholder={theme.phonePlaceholder || '+1 (555) 000-9999'} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                {optionConfig && optionConfig.options.length > 0 && (
                  <div className={styles.field}>
                    <label>{optionConfig.label}</label>
                    <div className={styles.inputShell}>
                      <select value={selectedOption?.value || ''} onChange={(e) => setSelectedOption(optionConfig.options.find((option) => option.value === e.target.value) || null)}>
                        {optionConfig.options.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {resolvedFields.map((field) => (
                  <div className={styles.field} key={field.name}>
                    <label>{field.label}</label>
                    <div className={`${styles.inputShell} ${field.type === 'textarea' ? styles.textareaShell : ''}`}>
                      <FieldControl field={field} value={extraState[field.name] || ''} onChange={handleExtraFieldChange} />
                    </div>
                    {field.helperText && <p className={styles.helperText}>{field.helperText}</p>}
                  </div>
                ))}

                {paymentDetails.calloutTitle && (
                  <div className={`${styles.paymentNotice} ${paymentDetails.hasConfigurationIssue ? styles.paymentNoticeError : ''}`}>
                    <strong>{paymentDetails.calloutTitle}</strong>
                    <p>{paymentDetails.calloutCopy}</p>
                  </div>
                )}

                {needsReceipt && (
                  <div className={styles.field}>
                    <label>{theme.receiptLabel || 'Bank transfer receipt'}</label>
                    <div className={styles.inputShell}>
                      <input type="file" accept="image/*" required onChange={(e) => setReceiptImage(e.target.files[0])} />
                    </div>
                    <p className={styles.helperText}>
                      {tenant.bank_transfer_instructions || theme.receiptHelperText || 'Please attach your transfer screenshot before booking.'}
                    </p>
                  </div>
                )}

                <div className={styles.summary}>
                  <div className={styles.summaryRow}>
                    <span>{theme.summaryServiceLabel || 'Service'}</span>
                    <strong>{selectedService ? selectedService.name : '—'}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>{theme.summaryDateLabel || 'Date & time'}</span>
                    <strong>{formatDisplayDate(selectedDate)} at {formatDisplayTime(selectedTime)}</strong>
                  </div>
                  {summaryRows.map((row) => (
                    <div className={styles.summaryRow} key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                  {paymentDetails.collectNow && (
                    <div className={styles.summaryRow}>
                      <span>{paymentDetails.summaryLabel}</span>
                      <strong>{formatCurrency(paymentDetails.dueToday, selectedService?.currency || 'JMD')}</strong>
                    </div>
                  )}
                  {paymentDetails.collectNow && paymentDetails.requirement === 'deposit' && paymentDetails.balanceLater > 0 && (
                    <div className={styles.summaryRow}>
                      <span>Remaining later</span>
                      <strong>{formatCurrency(paymentDetails.balanceLater, selectedService?.currency || 'JMD')}</strong>
                    </div>
                  )}
                  <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                    <span>{theme.totalLabel || 'Total'}</span>
                    <strong>{theme.totalFormatter ? theme.totalFormatter(totalAmount, selectedService) : `$${Number(totalAmount).toLocaleString()}`}</strong>
                  </div>
                </div>

                <button type="submit" className={styles.primaryButton} disabled={!selectedService || paymentDetails.hasConfigurationIssue}>
                  {theme.bookButtonLabel || paymentDetails.buttonLabel}
                </button>
                <div className={styles.footerNote}>
                  {theme.footerNote || 'Secure booking. Cancellation policy applies.'}
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>

      {confirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}><IconGlyph kind="check" className={styles.iconGlyph} /></div>
            <h2>{confirmModal.title}</h2>
            <p className={styles.modalLead}>
              {confirmModal.text}
            </p>
            <div className={styles.modalSummary}>
              <p className={styles.modalLabel}>Your appointment</p>
              <p className={styles.modalService}>{confirmModal.service}</p>
              <p className={styles.modalTime}>
                {new Date(`${confirmModal.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {' at '}
                {formatDisplayTime(confirmModal.time)}
              </p>
            </div>
            {confirmModal.status === 'confirmed' && (
              <>
                <p className={styles.modalToolsLabel}>Add to your calendar</p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => generateICS(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)}
                    className={styles.secondaryButton}
                  >
                    Apple / Outlook
                  </button>
                  <a
                    href={googleCalUrl(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.secondaryButton}
                  >
                    Google Calendar
                  </a>
                </div>
              </>
            )}
            <button type="button" onClick={() => { setConfirmModal(null); window.location.reload(); }} className={styles.primaryButton}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
