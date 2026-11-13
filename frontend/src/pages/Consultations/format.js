export const dateLabel = (stamp) => new Intl.DateTimeFormat('en-JM', {
  dateStyle: 'full', timeZone: 'America/Jamaica'
}).format(new Date(stamp));

export const timeLabel = (stamp) => new Intl.DateTimeFormat('en-JM', {
  timeStyle: 'short', timeZone: 'America/Jamaica'
}).format(new Date(stamp));

export const jamaicaDate = stamp => new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Jamaica'
}).format(new Date(stamp));

export function addToCalendar(booking, duration, draft) {
  const start = new Date(booking.startsAt);
  const end = new Date(start.getTime() + duration * 60000);
  const date = value => value.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: draft ? `ICSS Bookings consultation · ${draft.client_name}` : `ICSS consultation with ${booking.host}`,
    dates: `${date(start)}/${date(end)}`,
    ctz: 'America/Jamaica',
    ...(draft ? { details: `Client: ${draft.client_name} <${draft.email}>\nTopic: ${draft.topic}\nConsultant: ${booking.host}` } : {}),
    ...(booking.meetingUrl ? { location: booking.meetingUrl } : {})
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}
