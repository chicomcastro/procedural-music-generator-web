// Mobile-viewport smoke tests. Re-runs the most important user flows in a
// phone-sized viewport so regressions in mobile padding/sizing show up in CI
// (and in the sticky comment's screenshots).

describe('Mobile layout', () => {
  beforeEach(() => {
    cy.viewport(390, 844);  // iPhone 12 / 13 / 14
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
  });

  it('Default (Practice) view renders without horizontal overflow', () => {
    cy.get('#daw-main').should('exist');
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
    });
  });

  it('Sidebar opens via the toggle and closes via the backdrop', () => {
    cy.get('#sidebar-toggle').click();
    cy.get('#sidebar').should('have.class', 'open');
    cy.get('#sidebar-backdrop').click({ force: true });
    cy.get('#sidebar').should('not.have.class', 'open');
  });

  it('Learn view fits each module card on its own row', () => {
    cy.get('#sidebar-toggle').click();
    cy.get('.sidebar-link[data-view="learn"]').click({ force: true });
    cy.get('#view-learn').should('not.have.class', 'hidden');
    // The mobile media query stacks cards in a single column.
    cy.get('.learn-card').eq(0).then(($first) => {
      cy.get('.learn-card').eq(1).then(($second) => {
        // The second card sits below the first (top > bottom edge of first).
        expect($second[0].getBoundingClientRect().top).to.be.gte($first[0].getBoundingClientRect().bottom - 1);
      });
    });
  });

  it('Practice study controls use a 2-column grid on mobile', () => {
    cy.get('#sidebar-toggle').click();
    cy.get('.sidebar-link[data-view="practice"]').click({ force: true });
    cy.get('.practice-card[data-id="walking-bass-workout"]').click();
    cy.get('#practice-controls').then(($details) => $details[0].open = true);
    // The first two *visible* fields should sit on the same row on mobile
    // (hidden .practice-control fields drop out of the grid flow entirely,
    // so filter them out before comparing row positions).
    cy.get('.practice-control').filter(':visible').then(($fields) => {
      const a = $fields[0].getBoundingClientRect();
      const b = $fields[1].getBoundingClientRect();
      expect(Math.abs(a.top - b.top)).to.be.lte(2);
    });
  });
});
