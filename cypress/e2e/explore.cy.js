describe('Explore view — feed', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    // ADR 0005: Explore left the nav — reached via its (kept) deep link.
    cy.visit('/app.html#/explore', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('#view-explore', { timeout: 8000 }).should('not.have.class', 'hidden');
  });

  it('shows a feed card with seed and tags', () => {
    cy.get('#feed-card').should('be.visible');
    cy.get('#feed-seed').should('contain', 'seed');
    cy.get('#feed-tags').children().its('length').should('be.greaterThan', 1);
  });

  it('Skip records and advances the feed', () => {
    cy.get('#feed-seed').invoke('text').then((before) => {
      cy.get('#feed-skip').click();
      cy.wait(500);
      cy.get('#feed-seed').invoke('text').should('not.equal', before);
    });
  });

  it('Like records and advances the feed', () => {
    cy.get('#feed-seed').invoke('text').then((before) => {
      cy.get('#feed-like').click();
      cy.wait(500);
      cy.get('#feed-seed').invoke('text').should('not.equal', before);
    });
    cy.get('#explore-count-liked').should('have.text', '1');
  });

  it('opens Wrapped overlay (locked under 3 likes)', () => {
    cy.get('#explore-wrapped-btn').click();
    cy.get('#wrapped-overlay').should('not.have.class', 'hidden');
    cy.get('#wrapped-body').should('contain', 'Like at least 3 seeds');
  });
});
