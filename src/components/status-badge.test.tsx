import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

const render = (status: string | null) => renderToStaticMarkup(<StatusBadge status={status} />);

describe("StatusBadge", () => {
  it.each([
    ["Free", "free"],
    ["Held", "held"],
    ["Confirmed", "confirmed"],
    ["Expired", "expired"],
    ["Past", "past"],
  ])("статус %s — слово й варіант %s", (status, variant) => {
    const html = render(status);
    expect(html).toContain(`data-variant="${variant}"`);
    expect(html).toContain(`>${status}</span>`);
  });

  it("невідомий статус, ключ з прототипу чи порожній — слово лишається, вигляд нейтральний (past), а не «вільний»", () => {
    expect(render("toString")).toContain('data-variant="past"');
    expect(render("toString")).toContain(">toString</span>");
    expect(render(null)).toContain('data-variant="past"');
    expect(render(null)).toContain(">Unknown</span>");
  });
});
