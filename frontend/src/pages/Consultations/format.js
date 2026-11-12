export const dateLabel = (stamp) => new Intl.DateTimeFormat('en-JM', {
  dateStyle: 'full', timeZone: 'America/Jamaica'
}).format(new Date(stamp));

export const timeLabel = (stamp) => new Intl.DateTimeFormat('en-JM', {
  timeStyle: 'short', timeZone: 'America/Jamaica'
}).format(new Date(stamp));

export function addToCalendar(booking, duration) {
  const start = new Date(booking.startsAt);
  const end = new Date(start.getTime() + duration * 60000);
  const date = value => value.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const query = new URLSearchParams({
    action: 'TEMPLATE', text: `ICSS consultation with ${booking.host}`,
    dates: `${date(start)}/${date(end)}`,
    ...(booking.meetingUrl ? { location: booking.meetingUrl } : {})
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}
