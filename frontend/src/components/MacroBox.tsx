interface MacroBoxProps {
  value: number
  label: string
  unit?: string
}

/** Displays a single macro/metric value with its label (e.g. "340 kcal"). */
export default function MacroBox({ value, label, unit = ''  }: MacroBoxProps) {
  return (
    <div className="macro-box">
      <div className="macro-box__val">{value}{unit}</div>
      <div className="macro-box__lbl">{label}</div>
    </div>
  )
}