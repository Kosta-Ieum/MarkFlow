type BrandLoaderProps = {
  size?: number;
  className?: string;
};

// 파비콘 "M 노드 그래프"를 엣지→노드 순으로 그리는 무한 반복 로딩 인디케이터.
export function BrandLoader({ size = 64, className }: BrandLoaderProps) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">불러오는 중</span>
      <svg
        className="mf-loader"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="mf-loader-path"
          d="M9 22.5V10.5L16 19L23 10.5V22.5"
          fill="none"
          stroke="#10A36B"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
        />
        <circle className="mf-loader-node mf-loader-node-1" cx={9} cy={22.5} r={3} fill="#10A36B" />
        <circle className="mf-loader-node mf-loader-node-2" cx={9} cy={10.5} r={3} fill="#10A36B" />
        <circle className="mf-loader-node mf-loader-node-3" cx={16} cy={19} r={3} fill="#10A36B" />
        <circle className="mf-loader-node mf-loader-node-4" cx={23} cy={10.5} r={3} fill="#10A36B" />
        <circle className="mf-loader-node mf-loader-node-5" cx={23} cy={22.5} r={3} fill="#10A36B" />
      </svg>
    </div>
  );
}
