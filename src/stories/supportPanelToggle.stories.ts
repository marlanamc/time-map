import type { Meta, StoryObj } from "@storybook/html";

const meta = {
  title: "Shell/Support Tools Toggle",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.padding = "24px";
    wrap.innerHTML = `
      <button class="btn btn-ghost btn-icon support-panel-toggle-btn install-available" type="button">
        <span class="support-panel-celestial support-panel-sun" aria-hidden="true">☀️</span>
        <span class="support-panel-celestial support-panel-moon" aria-hidden="true">🌙</span>
      </button>
    `;
    return wrap;
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

