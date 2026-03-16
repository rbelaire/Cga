import { useState, useEffect } from 'react'

function getTimeLeft(targetDate) {
  const diff = new Date(targetDate) - new Date()
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return { days, hours, minutes }
}

function Unit({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="stat-number text-3xl sm:text-4xl font-bold text-gold leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs font-sans uppercase tracking-widest text-gray-400 mt-1">{label}</span>
    </div>
  )
}

export default function CountdownTimer({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 60_000)
    return () => clearInterval(id)
  }, [targetDate])

  if (!timeLeft) {
    return <p className="text-gray-400 font-sans text-sm">Tournament in progress or completed.</p>
  }

  return (
    <div className="flex items-center gap-6">
      <Unit value={timeLeft.days} label="Days" />
      <span className="text-gold text-2xl font-bold stat-number pb-4">:</span>
      <Unit value={timeLeft.hours} label="Hours" />
      <span className="text-gold text-2xl font-bold stat-number pb-4">:</span>
      <Unit value={timeLeft.minutes} label="Mins" />
    </div>
  )
}
