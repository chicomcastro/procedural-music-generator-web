// Walking-bass workout — moved from Learn (where it was the
// "walking-bass-generator" bonus module) to the Practice view as a
// multi-act study. This spec replaces the old Learn-side regression test.

describe('Walking-bass workout (Practice)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('.sidebar-link[data-view="practice"]', { timeout: 8000 }).click({ force: true });
    cy.get('#view-practice').should('not.have.class', 'hidden');
    cy.get('.practice-card[data-id="walking-bass-workout"]').click();
    cy.get('#practice-study-overlay').should('not.have.class', 'hidden');
  });

  it('renders the study controls', () => {
    cy.get('#practice-key').should('exist');
    cy.get('#practice-difficulty').should('exist');
    cy.get('#practice-seed').should('exist');
    cy.get('#practice-reroll').should('exist');
    cy.get('#practice-play').should('exist');
  });

  it('shows the 3 acts in the rail', () => {
    cy.get('.practice-act-rail-item').should('have.length', 3);
  });

  it('Play button toggles into the playing state on click', () => {
    cy.get('#practice-play').click();
    cy.get('#practice-play').should('have.class', 'is-playing');
  });

  it('Rolling a new seed updates the seed input', () => {
    // The seed input lives inside the collapsed <details>; open it before clicking.
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-seed').invoke('val').then((before) => {
      cy.get('#practice-reroll').click();
      cy.get('#practice-seed').invoke('val').should('not.equal', before);
    });
  });

  it('Changing the key updates the controls info', () => {
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-key').select('5');  // F
    cy.get('#practice-controls-info').should('contain', 'F');
  });
});
