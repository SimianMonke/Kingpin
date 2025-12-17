# UI_MCP_GUIDE.md: Orchestrating Magic UI, 21st.dev, and Playwright

This guide establishes the technical framework for the "Concept-to-Cloud" pipeline, utilizing tandem MCP orchestration to build production-ready, accessible, and visually elite web applications.

## 1. The MCP Architectural Hierarchy

Model Context Protocol (MCP) transitions LLMs from reasoning engines into integrated agents with environmental interaction.

- **Magic UI MCP (The Librarian)**: Specialized for discovery and retrieval of high-fidelity, animation-heavy components directly from the source repository.
- **21st.dev Magic (The Generator)**: A generative layer that creates three unique UI variations from natural language descriptions.
- **Playwright MCP (The Validator)**: Provides browser automation and "no-vision" semantic inspection via the accessibility tree.

## 2. The "Three Amigos" Workflow Pattern

Inspired by agile methodologies, this workflow ensures every feature is planned, implemented, and verified.

| Phase | Agent | Role | MCP Tool / Command |
|-------|-------|------|-------------------|
| 1. Planning | Product Owner | Use `get_all_components` (Magic UI) or `inspiration_fetcher` (21st.dev) to propose a structural plan in Plan Mode. |
| 2. Prototyping | Developer | Execute the `/ui` command (21st.dev) to scaffold primary layouts and install dependencies like `tailwind-merge`. |
| 3. Enhancement | Developer | Use specialized Magic UI tools (e.g., `getMotion`, `getEffects`) to integrate production-grade animations. |
| 4. Validation | Tester | Invoke Playwright MCP to launch a browser and run deterministic checks. |
| 5. Refinement | Tester/Dev | Auto-refactor code based on `browser_console_messages` or `aria-snapshot` failures until a "pass" state is achieved. |

## 3. Verification & Audit Protocols

To ensure adherence to design principles and accessibility, the following audits are mandatory for every component.

### A. Programmatic Design Token Audit

Use `browser_evaluate` to run JavaScript checks on computed styles, ensuring they match established CSS variables for colors and typography.

```javascript
// Verification script for Design System adherence
async (page) => {
  const audit = await page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll('.design-system-target'));
    return targets.map(el => {
      const styles = window.getComputedStyle(el);
      return {
        component: el.tagName,
        background: styles.backgroundColor, // Audit against brand-primary-500
        radius: styles.borderRadius // Audit against var(--radius-md)
      };
    });
  });
  return audit;
};
```

### B. Accessibility Tree Validation

Use the `aria-snapshot` capability to assert that the semantic structure matches the required accessible template. This ensures that visual enhancements do not break screen-reader compatibility.

## 4. Operational Directives for the Agent

- **Tool Budgeting**: Use categorized toolsets (e.g., `getTextReveal`, `getButtons`) to manage the model's context window effectively.
- **Subagent Delegation**: For complex tasks, spawn a "Designer" subagent with Playwright tools to handle visual validation while the main agent handles state management.
- **Context Efficiency**: Prioritize Programmatic Tool Calling by writing scripts to orchestrate multi-step browser tasks locally to save tokens.
- **Deterministic HTML**: Always write semantic HTML to make automated testing via the accessibility tree more reliable.

## 5. Definition of Done

A feature is only complete when:

1. Components are sourced from Magic UI or 21st.dev.
2. Styling is verified via `browser_evaluate` against design tokens.
3. Responsive breakpoints are tested using `browser_resize`.
4. An `aria-snapshot` accessibility audit returns a "pass" state.
