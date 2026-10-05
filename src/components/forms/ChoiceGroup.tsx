interface Option {
  value: string;
  label: string;
}

interface ChoiceGroupProps {
  name: string;
  legend: string;
  helper?: string;
  options: Option[];
  type: 'radio' | 'checkbox';
  defaultValue?: string;
}

// A group of radio buttons or checkboxes inside a fieldset with a visible legend.
export function ChoiceGroup({ name, legend, helper, options, type, defaultValue }: ChoiceGroupProps) {
  const helperId = helper ? `${name}-helper` : undefined;
  return (
    <fieldset class="choice-group" aria-describedby={helperId}>
      <legend>{legend}</legend>
      {helper && (
        <p id={helperId} class="field-helper">
          {helper}
        </p>
      )}
      {options.map((option) => (
        <label class="choice" key={option.value}>
          <input type={type} name={name} value={option.value} defaultChecked={option.value === defaultValue} />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
