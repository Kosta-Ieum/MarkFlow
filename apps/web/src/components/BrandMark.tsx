type BrandMarkProps = {
  size?: number;
  className?: string;
};

// 정적 브랜드 마크 — BrandLoader와 동일 지오메트리(M 노드 그래프). 애니메이션 없음.
export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 22.5V10.5L16 19L23 10.5V22.5"
        fill="none"
        stroke="#10A36B"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={9} cy={22.5} r={3} fill="#10A36B" />
      <circle cx={9} cy={10.5} r={3} fill="#10A36B" />
      <circle cx={16} cy={19} r={3} fill="#10A36B" />
      <circle cx={23} cy={10.5} r={3} fill="#10A36B" />
      <circle cx={23} cy={22.5} r={3} fill="#10A36B" />
    </svg>
  );
}
