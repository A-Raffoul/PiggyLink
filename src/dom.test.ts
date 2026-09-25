// @vitest-environment jsdom
import { expect, it } from "vitest";
import { getByRole } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

it("jsdom + testing-library are wired up", async () => {
  document.body.innerHTML = `<button>0</button>`;
  const button = getByRole(document.body, "button");
  button.addEventListener("click", () => (button.textContent = "1"));
  await userEvent.click(button);
  expect(button.textContent).toBe("1");
});
