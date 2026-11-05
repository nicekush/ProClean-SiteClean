import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Local CPU benchmark. It does not connect to Firebase or open a browser.
const db = JSON.parse(await readFile(new URL('../data/db.json', import.meta.url), 'utf8'));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { WorkOrdersGrid } = await server.ssrLoadModule('/src/components/WorkOrdersGrid.tsx');
  const { PermissionContext } = await server.ssrLoadModule('/src/security/PermissionContext.tsx');
  const noop = () => {};
  for (const role of ['SUPER_ADMIN', 'SUPERVISOR_TERRENO']) {
    for (const count of [db.workOrders.length, 2170]) {
      const orders = Array.from({ length: count }, (_, i) => ({ ...db.workOrders[i % db.workOrders.length], id: `benchmark-${i}` }));
      const props = { ...db, workOrders: orders, currentRole: role,
        onAddWorkOrder: noop, onUpdateWorkOrder: noop, onDeleteWorkOrder: noop,
        onItoApproveWorkOrder: noop, onCreateComponent: noop };
      const user = { id: 'benchmark', active: true, role };
      const view = createElement(PermissionContext.Provider, { value: user }, createElement(WorkOrdersGrid, props));
      const times = [];
      let html;
      for (let run = 0; run < 4; run++) {
        const start = performance.now();
        html = renderToStaticMarkup(view);
        if (run > 0) times.push(performance.now() - start);
      }
      console.log(JSON.stringify({ role, orders: count,
        medianRenderMs: Number(times.sort((a, b) => a - b)[1].toFixed(1)),
        tableRows: (html.match(/<tr\b/g) || []).length - 1,
        mobileCards: (html.match(/class="mobile-ot-card"/g) || []).length,
        htmlKB: Math.round(Buffer.byteLength(html) / 1024),
      }));
    }
  }
} finally {
  await server.close();
}
