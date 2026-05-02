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

  const resolvedPaymentMode = (() => {
    const serviceMode = selectedService?.payment_mode;
    if (serviceMode && serviceMode !== 'tenant_default') return serviceMode;
    return tenant.default_payment_mode || 'none';
  })();
  const needsReceipt = resolvedPaymentMode === 'manual' && tenant.manual_payment_enabled;

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
        setConfirmModal({ service: selectedService.name, date: selectedDate, time: selectedTime });
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
                  : <i className={`fas ${theme.icon || 'fa-calendar-check'}`}></i>}
              </div>
              <div className={styles.brandText}>
                <h1>{tenant.name}</h1>
                {tenant.branding?.bookingTagline && (
                  <p className={styles.brandTagline}>{tenant.branding.bookingTagline}</p>
                )}
                {tenant.branding?.location && (
                  <div className={styles.brandLocation}>
                    <i className="fas fa-location-dot"></i>
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
                <i className={`fas ${theme.serviceIcon || theme.icon || 'fa-list'}`}></i>
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
                        <i className={`fas ${theme.itemIcon || theme.icon || 'fa-star'}`}></i>
                      </div>
                      <div className={styles.serviceText}>
                        <h3>{service.name}</h3>
                        <span>{service.duration_minutes} min</span>
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
                  <i className="fas fa-calendar-alt"></i>
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
                <i className={`fas ${theme.detailsIcon || 'fa-user-pen'}`}></i>
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
                  <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                    <span>{theme.totalLabel || 'Total'}</span>
                    <strong>{theme.totalFormatter ? theme.totalFormatter(totalAmount, selectedService) : `$${Number(totalAmount).toLocaleString()}`}</strong>
                  </div>
                </div>

                <button type="submit" className={styles.primaryButton} disabled={!selectedService}>
                  {theme.bookButtonLabel || 'Complete Booking'}
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
            <div className={styles.modalIcon}><i className="fas fa-check"></i></div>
            <h2>{theme.confirmationTitle || 'Booking Confirmed'}</h2>
            <p className={styles.modalLead}>
              {theme.confirmationText || 'A confirmation email is on its way with all of your appointment details.'}
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
            <button type="button" onClick={() => { setConfirmModal(null); window.location.reload(); }} className={styles.primaryButton}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
