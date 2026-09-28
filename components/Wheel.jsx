const R = 200;
const COLORS = [
  ["#9146ff", "#ffffff"],
  ["#c6ff3d", "#0f0b17"],
  ["#ff5fa2", "#0f0b17"],
  ["#3ddcff", "#0f0b17"],
  ["#ffb23d", "#0f0b17"],
  ["#5b2bd6", "#ffffff"],
];

export function slices(pool) {
  const total = pool.reduce((t, p) => t + p.weight, 0);
  let acc = 0;
  return pool.map((p, i) => {
    const a0 = (acc / total) * 360;
    acc += p.weight;
    return { ...p, a0, a1: (acc / total) * 360, share: p.weight / total, color: COLORS[i % COLORS.length] };
  });
}

const point = (a) => `${(R * Math.sin((a * Math.PI) / 180)).toFixed(2)} ${(-R * Math.cos((a * Math.PI) / 180)).toFixed(2)}`;
const arc = (a0, a1) => `M0 0 L${point(a0)} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${point(a1)}Z`;

export default function Wheel({ parts, className = "", svgClassName = "", svgStyle, wheelRef, onTransitionEnd }) {
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden className="absolute -top-4 left-1/2 z-10 -translate-x-1/2" width="46" height="50" viewBox="0 0 46 50">
        <path d="M3 3H43L23 45Z" fill="#f6f1ff" stroke="#0f0b17" strokeWidth="5" strokeLinejoin="round" />
      </svg>
      <svg
        ref={wheelRef}
        viewBox="-212 -212 424 424"
        className={`block w-full ${svgClassName}`}
        style={svgStyle}
        onTransitionEnd={onTransitionEnd}
        role="img"
        aria-label={`Wheel with ${parts.length} ideas`}
      >
        <circle r="210" fill="#f6f1ff" />
        {parts.map((p) => {
          const size = Math.min(17, (p.a1 - p.a0) * 0.8);
          return (
            <g key={p.id}>
              <path d={arc(p.a0, p.a1)} fill={p.color[0]} stroke="#0f0b17" strokeWidth="3" />
              {size >= 6 && (
                <text
                  transform={`rotate(${(p.a0 + p.a1) / 2 - 90}) translate(${R * 0.58} 0)`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={p.color[1]}
                  fontSize={size}
                  fontWeight="800"
                >
                  {p.title.length > 18 ? `${p.title.slice(0, 17)}…` : p.title}
                </text>
              )}
            </g>
          );
        })}
        <circle r="32" fill="#0f0b17" stroke="#f6f1ff" strokeWidth="5" />
        <text textAnchor="middle" dominantBaseline="central" fill="#c6ff3d" fontSize="28" style={{ fontFamily: "var(--font-bungee)" }}>
          J
        </text>
      </svg>
    </div>
  );
}
