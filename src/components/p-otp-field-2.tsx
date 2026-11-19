import { Field, FieldLabel } from "@/components/ui/field";
import { OTPField, OTPFieldInput } from "@/components/ui/otp-field";

const PIN_LENGTH = 6;

export function PinField() {
  return (
    <Field>
      <FieldLabel>PIN</FieldLabel>
      <OTPField length={PIN_LENGTH} size="lg" name="pin" required className="w-full">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <div key={index} className="flex min-w-0 flex-1 items-center gap-2">
            {index === 3 ? (
              <span aria-hidden className="text-lg text-muted-foreground">
                –
              </span>
            ) : null}
            <OTPFieldInput
              className="min-w-0 w-full flex-1"
              aria-label={index === 0 ? undefined : `Digit ${index + 1} of ${PIN_LENGTH}`}
            />
          </div>
        ))}
      </OTPField>
    </Field>
  );
}
