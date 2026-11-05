import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('OT view bounds both responsive lists but reports hours and counts for all matches', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { WorkOrdersGrid } = await server.ssrLoadModule('/src/components/WorkOrdersGrid.tsx');
    const { PermissionContext } = await server.ssrLoadModule('/src/security/PermissionContext.tsx');
    const noop = () => {};
    const orders = Array.from({ length: 120 }, (_, i) => ({ id: `o-${i}`, sapCode: `OT-${i + 1}`,
      shiftId: 's1', shiftName: 'Día', executionDate: '2026-11-04', status: 'PENDIENTE_APROBACION_ITO',
      headcount: 2, realHours: 8, machineHours: 1.5, equipoCorrea: 'CT32', operationDetail: 'Aseo' }));
    const props = { workOrders: orders, users: [], shifts: [], machines: [], plantAreas: [], sectors: [],
      equipments: [], subSectors: [], whiteLabel: { columnLabels: { sapCode: 'N° OT' } },
      onAddWorkOrder: noop, onUpdateWorkOrder: noop, onDeleteWorkOrder: noop,
      onItoApproveWorkOrder: noop, onCreateComponent: noop };
    const render = (role, extra = {}) => renderToStaticMarkup(createElement(PermissionContext.Provider,
      { value: { id: 'test', role, active: true } }, createElement(WorkOrdersGrid, { ...props, ...extra })));
    const html = render('SUPER_ADMIN');
    assert.equal((html.match(/<tr\b/g) || []).length - 1, 50);
    assert.equal((html.match(/class="mobile-ot-card"/g) || []).length, 50);
    assert.ok(html.includes('Mostrando 1–50 de 120 OT'));
    assert.ok(html.includes('Total HH: 1.920'));
    assert.ok(html.includes('Total HM: 180'));
    assert.ok(html.includes('Los KPI y el Excel incluyen todas las OT filtradas.'));
    assert.ok(html.includes('Otorgar Conformidad Mandante'));
    const supervisor = render('SUPERVISOR_TERRENO');
    assert.equal(supervisor.includes('Otorgar Conformidad Mandante'), false);
    const empty = render('SUPER_ADMIN', { workOrders: [] });
    assert.ok(empty.includes('Mostrando 0–0 de 0 OT'));
    assert.ok(empty.includes('Total HH: 0'));
    assert.equal((empty.match(/class="mobile-ot-card"/g) || []).length, 0);
  } finally {
    await server.close();
  }
});
