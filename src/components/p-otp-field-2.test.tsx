import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PinField } from "./p-otp-field-2";

it("PIN 6 digit terkirim lewat FormData", () => {
  const html = renderToStaticMarkup(
    <form>
      <PinField />
    </form>,
  );

  expect(html.match(/data-slot="otp-field-input"/g)).toHaveLength(6);
  expect(html).toContain('name="pin"');
  expect(html).toContain("PIN");
});
