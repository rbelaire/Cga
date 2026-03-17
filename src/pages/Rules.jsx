import PageWrapper from '../components/layout/PageWrapper'

const rules = [
  {
    title: 'Ball Movement — General',
    icon: '⛳',
    body: [
      'You are allowed to move the ball one club length, no closer to the hole.',
      'You may move your ball from the rough to the fairway, or from the fairway to the rough.',
      'You cannot move your ball once it is on the green.',
      'You cannot move your ball from the fringe onto the green, or from the green onto the fringe.',
      'Putt all putts out.',
    ],
  },
  {
    title: 'Water Hazards',
    icon: '💧',
    body: [
      'You cannot move your ball if it is touching any water in a water hazard, whether the hazard is marked or unmarked.',
      'You cannot move your ball if the body of water has receded due to drought. The edge of the water bank is the defining line.',
      'You may hit your ball out of a water hazard without moving the ball.',
      'Casual water as defined by the USGA Rules of Golf is the only water from which you may move your ball.',
    ],
  },
  {
    title: 'Sand Bunkers',
    icon: '🏖️',
    body: [
      'You cannot move your ball in a sand bunker.',
      'The only time a ball may be touched in a sand bunker is if the board deems it unplayable prior to the round.',
    ],
  },
  {
    title: 'Out of Bounds',
    icon: '🚩',
    body: [
      'We play everything lateral except OB.',
      'CGA allows the OB rule: you may go to the fairway and take a drop with a 2-stroke penalty.',
      'This rule was added to improve pace of play.',
    ],
  },
  {
    title: 'Unmarked Hazards',
    icon: '🌿',
    body: [
      'If your ball is in an unmarked hazard — such as native grass, bushes, or a heavy tree line — you may move your ball one club length.',
      'This does NOT apply to sand bunkers or water hazards.',
      'If the hazard is marked, you cannot move your ball, but you may still hit from the hazard.',
    ],
  },
  {
    title: 'Tee Boxes',
    icon: '🏌️',
    body: [
      'Senior and Super Senior tee boxes are available to make the game fun and fair for all members.',
      'These were added after the association\'s founding to accommodate all skill and age levels.',
    ],
  },
]

export default function Rules() {
  return (
    <PageWrapper className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">CGA Rules</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-xl leading-relaxed">
          The Carencro Golf Association was formed in the 1980s and has followed these rules since its founding.
          The board is committed to following and enforcing these rules during all tournaments.
        </p>
      </div>

      {/* Rule cards */}
      <div className="space-y-4 mb-10">
        {rules.map(({ title, icon, body }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-5 py-3 flex items-center gap-3">
              <span className="text-xl" role="presentation">{icon}</span>
              <h2 className="text-white font-serif text-lg font-semibold">{title}</h2>
            </div>
            <ul className="px-5 py-4 space-y-2">
              {body.map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                  <span className="text-gray-600 font-sans text-sm leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Contact footer */}
      <div className="bg-forest rounded-lg px-6 py-5 text-center">
        <p className="text-offwhite font-serif text-lg font-semibold mb-1">Questions about the rules?</p>
        <p className="text-gray-300 font-sans text-sm">
          Feel free to reach out to any board member or send us an email.
        </p>
      </div>
    </PageWrapper>
  )
}
