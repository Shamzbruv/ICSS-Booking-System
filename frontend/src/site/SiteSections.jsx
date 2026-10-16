import { useState } from 'react';
import s from './TenantWebsite.module.css';
import { HeroBackground, Lightbox, SmartImage } from './SiteMedia';
import { isSafeMediaUrl, youtubeOrVimeoEmbed } from './siteSchema';

function Lines({ text }) {
  if (!text) return null;
  const parts = String(text).split('\n');
  return parts.map((line, index) => (
    <span key={index}>{line}{index < parts.length - 1 && <br />}</span>
  ));
}

function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  if (!eyebrow && !title && !subtitle) return null;
  return (
    <header className={`${s.sectionHeading} ${align === 'left' ? s.sectionHeadingLeft : ''}`}>
      {eyebrow && <p className={s.eyebrow}>{eyebrow}</p>}
      {title && <h2 className={s.sectionTitle}><Lines text={title} /></h2>}
      {subtitle && <p className={s.sectionSubtitle}>{subtitle}</p>}
    </header>
  );
}

function formatPrice(service) {
  const price = Number(service.price || 0);
  if (price === 0) return 'Free';
  return `${service.currency || 'JMD'} ${price.toLocaleString()}`;
}

function formatDuration(minutes) {
  const total = Number(minutes || 0);
  if (!total) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h} hr${h > 1 ? 's' : ''}` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

// ── Sections ─────────────────────────────────────────────────────────────────

function Hero({ props, ctx }) {
  const overlay = Number(props.overlay ?? 0.45);
  return (
    <section className={`${s.hero} ${s[`hero_${props.height || 'full'}`] || ''} ${props.align === 'left' ? s.heroLeft : ''}`}>
      <HeroBackground props={props} fallback={ctx.fallback} />
      <div className={s.heroOverlay} style={{ background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.75}) 0%, rgba(0,0,0,${overlay}) 100%)` }} />
      <div className={`${s.container} ${s.heroContent}`}>
        {props.eyebrow && <p className={s.heroEyebrow}>{props.eyebrow}</p>}
        {props.headline && <h1 className={s.heroTitle}><Lines text={props.headline} /></h1>}
        {props.subheadline && <p className={s.heroSubtitle}>{props.subheadline}</p>}
        <div className={s.heroActions}>
          {props.ctaLabel && <ctx.SiteLink target={props.ctaTarget || 'book'} className={s.btnPrimary}>{props.ctaLabel}</ctx.SiteLink>}
          {props.secondaryLabel && <ctx.SiteLink target={props.secondaryTarget || 'about'} className={s.btnGhostLight}>{props.secondaryLabel}</ctx.SiteLink>}
        </div>
      </div>
      {props.height === 'full' && <span className={s.scrollCue} aria-hidden="true" />}
    </section>
  );
}

function PageHeader({ props, ctx }) {
  const overlay = Number(props.overlay ?? 0.5);
  return (
    <section className={s.pageHeader}>
      <HeroBackground props={{ mediaType: isSafeMediaUrl(props.imageUrl) ? 'image' : 'color', imageUrl: props.imageUrl }} fallback={ctx.fallback} />
      <div className={s.heroOverlay} style={{ background: `rgba(0,0,0,${overlay})` }} />
      <div className={`${s.container} ${s.pageHeaderContent}`}>
        {props.title && <h1 className={s.heroTitle}>{props.title}</h1>}
        {props.subtitle && <p className={s.heroSubtitle}>{props.subtitle}</p>}
      </div>
    </section>
  );
}

function Intro({ props, ctx }) {
  return (
    <section className={s.section}>
      <div className={`${s.container} ${s.split} ${props.imageSide === 'left' ? s.splitReverse : ''}`}>
        <div className={s.splitText}>
          <SectionHeading eyebrow={props.eyebrow} title={props.title} align="left" />
          {props.body && <p className={s.bodyText}><Lines text={props.body} /></p>}
          {props.ctaLabel && <ctx.SiteLink target={props.ctaTarget || 'book'} className={s.btnPrimary}>{props.ctaLabel}</ctx.SiteLink>}
        </div>
        <SmartImage src={props.imageUrl} alt={props.title || ''} className={s.splitImage} fallback={ctx.fallback} />
      </div>
    </section>
  );
}

function Highlights({ props }) {
  const items = props.items || [];
  return (
    <section className={s.section}>
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        <div className={s.highlightGrid} data-count={Math.min(items.length, 4)}>
          {items.map((item, index) => (
            <article key={index} className={s.card}>
              {item.icon && <div className={s.highlightIcon} aria-hidden="true">{item.icon}</div>}
              {item.title && <h3>{item.title}</h3>}
              {item.text && <p>{item.text}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services({ props, ctx }) {
  const list = ctx.services.slice(0, Number(props.limit || 6));
  return (
    <section className={s.section}>
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        {list.length === 0 ? (
          <p className={s.emptyNote}>Services you add in your dashboard appear here automatically.</p>
        ) : (
          <div className={s.serviceGrid}>
            {list.map((service) => (
              <article key={service.id} className={s.serviceItem}>
                {isSafeMediaUrl(service.image_url) && <SmartImage src={service.image_url} alt="" className={s.serviceThumb} fallback={ctx.fallback} />}
                <div className={s.serviceBody}>
                  <div className={s.serviceTop}>
                    <h3>{service.name}</h3>
                    {props.showPrices !== false && <span className={s.servicePrice}>{formatPrice(service)}</span>}
                  </div>
                  {service.description && <p>{service.description}</p>}
                  <div className={s.serviceMeta}>
                    {props.showDuration !== false && formatDuration(service.duration_minutes) && <span>⏱ {formatDuration(service.duration_minutes)}</span>}
                    <ctx.SiteLink target="book" serviceId={service.id} className={s.serviceBook}>{props.ctaLabel || 'Book'} →</ctx.SiteLink>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Gallery({ props, ctx }) {
  const images = (props.images || []).filter((image) => isSafeMediaUrl(image?.url));
  const [open, setOpen] = useState(null);
  const layout = props.layout || 'grid';
  return (
    <section className={s.section}>
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        {images.length === 0 ? (
          <p className={s.emptyNote}>Add photos to this gallery in the Website Builder.</p>
        ) : (
          <div className={`${s.gallery} ${s[`gallery_${layout}`] || ''}`} style={{ '--tile-aspect': props.aspect || '4/5' }}>
            {images.map((image, index) => (
              <button type="button" key={`${image.url}-${index}`} className={s.galleryTile} onClick={() => setOpen(index)} aria-label={image.caption || `Open photo ${index + 1}`}>
                <SmartImage src={image.url} alt={image.caption || ''} fallback={ctx.fallback} />
                {image.caption && <span className={s.galleryCaption}>{image.caption}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Testimonials({ props }) {
  const items = props.items || [];
  return (
    <section className={`${s.section} ${s.sectionTinted}`}>
      <div className={s.container}>
        <SectionHeading title={props.title} />
        <div className={s.quoteGrid}>
          {items.map((item, index) => (
            <figure key={index} className={s.quoteCard}>
              <div className={s.quoteMark} aria-hidden="true">“</div>
              <blockquote>{item.quote}</blockquote>
              <figcaption><strong>{item.name}</strong>{item.role && <span>{item.role}</span>}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team({ props, ctx }) {
  return (
    <section className={s.section}>
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        <div className={s.teamGrid}>
          {(props.members || []).map((member, index) => (
            <article key={index} className={s.teamCard}>
              <SmartImage src={member.photoUrl} alt={member.name || ''} className={s.teamPhoto} fallback={ctx.fallback} />
              <h3>{member.name}</h3>
              {member.role && <p className={s.teamRole}>{member.role}</p>}
              {member.bio && <p>{member.bio}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats({ props }) {
  return (
    <section className={s.statsBand}>
      <div className={`${s.container} ${s.statsGrid}`}>
        {(props.items || []).map((item, index) => (
          <div key={index} className={s.stat}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function VideoSection({ props, ctx }) {
  const embed = youtubeOrVimeoEmbed(props.videoUrl);
  return (
    <section className={s.section}>
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        <div className={s.videoFrame} style={{ background: ctx.fallback }}>
          {embed ? (
            <iframe src={embed} title={props.title || 'Video'} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
          ) : isSafeMediaUrl(props.videoUrl) ? (
            <video src={props.videoUrl} poster={isSafeMediaUrl(props.posterUrl) ? props.posterUrl : undefined} controls playsInline preload="metadata" />
          ) : (
            <p className={s.emptyNote}>Add a video file or a YouTube / Vimeo link.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Faq({ props }) {
  return (
    <section className={s.section}>
      <div className={`${s.container} ${s.narrow}`}>
        <SectionHeading title={props.title} />
        <div className={s.faqList}>
          {(props.items || []).map((item, index) => (
            <details key={index} className={s.faqItem}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta({ props, ctx }) {
  const hasImage = isSafeMediaUrl(props.imageUrl);
  return (
    <section className={`${s.ctaBand} ${hasImage ? s.ctaBandImage : ''}`}>
      {hasImage && <HeroBackground props={{ mediaType: 'image', imageUrl: props.imageUrl }} fallback={ctx.fallback} />}
      {hasImage && <div className={s.heroOverlay} style={{ background: 'rgba(0,0,0,0.55)' }} />}
      <div className={`${s.container} ${s.ctaContent}`}>
        {props.title && <h2>{props.title}</h2>}
        {props.text && <p>{props.text}</p>}
        {props.buttonLabel && <ctx.SiteLink target={props.target || 'book'} className={hasImage ? s.btnPrimary : s.btnInverse}>{props.buttonLabel}</ctx.SiteLink>}
      </div>
    </section>
  );
}

function Contact({ props, ctx }) {
  const { contact } = ctx.site;
  const mapQuery = contact.mapQuery || contact.address;
  const whatsapp = String(contact.whatsapp || '').replace(/[^0-9]/g, '');
  return (
    <section className={`${s.section} ${s.sectionTinted}`} id="contact">
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        <div className={`${s.contactGrid} ${props.showMap && mapQuery ? '' : s.contactGridSingle}`}>
          <div className={s.contactInfo}>
            {contact.address && <div className={s.contactRow}><span aria-hidden="true">📍</span><p><Lines text={contact.address} /></p></div>}
            {contact.phone && <div className={s.contactRow}><span aria-hidden="true">📞</span><a href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`}>{contact.phone}</a></div>}
            {whatsapp && <div className={s.contactRow}><span aria-hidden="true">💬</span><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>}
            {contact.email && <div className={s.contactRow}><span aria-hidden="true">✉️</span><a href={`mailto:${contact.email}`}>{contact.email}</a></div>}
            {props.showHours !== false && (props.hours || []).length > 0 && (
              <dl className={s.hoursList}>
                {props.hours.map((row, index) => (
                  <div key={index}><dt>{row.day}</dt><dd>{row.time}</dd></div>
                ))}
              </dl>
            )}
            {!contact.address && !contact.phone && !contact.email && !whatsapp && (
              <p className={s.emptyNote}>Add your address, phone and WhatsApp in the Website Builder → Contact.</p>
            )}
            <ctx.SiteLink target="book" className={s.btnPrimary}>{ctx.site.nav.bookLabel || 'Book now'}</ctx.SiteLink>
          </div>
          {props.showMap && mapQuery && (
            <div className={s.mapFrame}>
              <iframe title="Map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Booking({ props, ctx }) {
  return (
    <section className={`${s.section} ${s.bookingSection}`} id="book">
      <div className={s.container}>
        <SectionHeading title={props.title} subtitle={props.subtitle} />
        {ctx.renderBooking()}
      </div>
    </section>
  );
}

const COMPONENTS = {
  hero: Hero,
  pageHeader: PageHeader,
  intro: Intro,
  highlights: Highlights,
  services: Services,
  gallery: Gallery,
  testimonials: Testimonials,
  team: Team,
  stats: Stats,
  video: VideoSection,
  faq: Faq,
  cta: Cta,
  contact: Contact,
  booking: Booking
};

export function SiteSection({ section, ctx }) {
  const Component = COMPONENTS[section.type];
  if (!Component) return null;
  return <Component props={section.props || {}} ctx={ctx} />;
}
