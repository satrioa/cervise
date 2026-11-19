import { Field, FieldLabel } from "@/components/ui/field";
import { OTPField, OTPFieldInput } from "@/components/ui/otp-field";

const PIN_LENGTH = 6;

export function PinField() {
  return (
    <Field>
      <FieldLabel>PIN</FieldLabel>
      <OTPField length={PIN_LENGTH} size="lg" name="pin" required>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <OTPFieldInput
            key={index}
            aria-label={index === 0 ? undefined : `Digit ${index + 1} of ${PIN_LENGTH}`}
          />
        ))}
      </OTPField>
    </Field>
  );
}
