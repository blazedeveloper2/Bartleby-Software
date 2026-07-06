/* ═══════════════════════════════════════════════════════════
   FINANCE APP — scaffold.

   This is the next app to build. It already plugs into the shell
   (appears as a tab, mounts/unmounts) so building it out just means
   filling in mount() with real screens — the same way the workout
   app is structured (data.js + index.js + finance.css).
   ═══════════════════════════════════════════════════════════ */

export default {
  id: 'finance',
  name: 'Finance',
  soon: true,
  styles: 'apps/finance/finance.css',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  mount(root) {
    root.innerHTML = `
      <div class="fin">
        <div class="app-head"><h1>Finance</h1><p>Personal Finance Software</p></div>
        <div class="placeholder">
          <div class="ph-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h2>Finance — coming next</h2>
          <p>This app is wired into Bartleby Software and ready to build out. Tell me what you want it to do and we'll fill it in.</p>
          <p class="ph-note">Data stays local in your browser, just like the workout app.</p>
          <div class="ph-plan">
            <div class="ph-plan-row"><span class="ph-dot"></span><b>Accounts &amp; balances</b><span>planned</span></div>
            <div class="ph-plan-row"><span class="ph-dot"></span><b>Income &amp; expense tracking</b><span>planned</span></div>
            <div class="ph-plan-row"><span class="ph-dot"></span><b>Budgets &amp; categories</b><span>planned</span></div>
            <div class="ph-plan-row"><span class="ph-dot"></span><b>Net-worth trend chart</b><span>planned</span></div>
          </div>
        </div>
      </div>`;
  },
  unmount() {},
};
