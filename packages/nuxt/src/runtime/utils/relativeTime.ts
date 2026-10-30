/**
 * "Just now", "5 min ago", "Yesterday", then a date, how the files list
 * says when a drawing was last edited. Intl does the wording, so it reads
 * naturally in the user's locale.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })
const sameYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const otherYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function formatEditedAgo(time: number, now: number): string {
  const elapsed = Math.max(0, now - time)
  if (elapsed < MINUTE) {
    return 'Just now'
  }
  if (elapsed < HOUR) {
    return relative.format(-Math.floor(elapsed / MINUTE), 'minute')
  }
  if (elapsed < DAY) {
    return relative.format(-Math.floor(elapsed / HOUR), 'hour')
  }
  if (elapsed < 7 * DAY) {
    return relative.format(-Math.floor(elapsed / DAY), 'day')
  }
  const date = new Date(time)
  return (date.getFullYear() === new Date(now).getFullYear() ? sameYear : otherYear).format(date)
}
