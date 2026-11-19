import { Fragment } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { OTPField, OTPFieldInput } from "@/components/ui/otp-field";

const PIN_LENGTH = 6;

export function PinField() {
  return (
    <Field>
      <FieldLabel>PIN</FieldLabel>
      <OTPField length={PIN_LENGTH} name="pin" required className="w-full">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <Fragment key={index}>
            {index === 3 ? (
              <span aria-hidden className="text-lg text-muted-foreground">
                –
              </span>
            ) : null}
            <OTPFieldInput
              className="!h-8.5 !w-full min-w-0 flex-1 sm:!h-7.5"
              aria-label={index === 0 ? undefined : `Digit ${index + 1} of ${PIN_LENGTH}`}
            />
          </Fragment>
        ))}
      </OTPField>
    </Field>
  );
}
