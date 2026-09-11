export const ProgressBar = ({ value }: { value: number }) => (
  <div className="progress">
    <div className="progress__bar" style={{ width: `${value}%` }}></div>
  </div>
)
