interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
}

export function Slider({ label, value, onChange, help }: SliderProps) {
  return (
    <label className="control">
      <span className="control-row">
        <span>{label}</span>
        <strong>{value}%</strong>
      </span>
      <input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {help ? <small>{help}</small> : null}
    </label>
  );
}
