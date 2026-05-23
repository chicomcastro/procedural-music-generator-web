// Regression: the walking-bass generator's Play button used to be a no-op
// because the click handler only ran for step.type === 'exercise'. The fix
// extended it to handle 'generator' steps too. This spec confirms the play
// button flips into the playing state when clicked on the generator step.

describe('Walking-bass generator', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('.sidebar-link[data-view="learn"]', { timeout: 8000 }).click();
    cy.get('#view-learn').should('not.have.class', 'hidden');
    cy.get('.learn-card[data-id="walking-bass-generator"]', { timeout: 8000 }).click();
    cy.get('#learn-exercise-overlay').should('not.have.class', 'hidden');
    // Step 0 is theory; the generator UI lives on step 1.
    cy.get('.exercise-step-rail-item').eq(1).click();
    cy.get('#generator-panel').should('not.have.attr', 'hidden');
  });

  it('renders the generator controls', () => {
    cy.get('#generator-tonic').should('exist');
    cy.get('#generator-scale').should('exist');
    cy.get('#generator-progression').should('exist');
    cy.get('#generator-tempo').should('exist');
    cy.get('#generator-seed').should('exist');
    cy.get('#generator-reroll').should('exist');
  });

  it('Play button toggles into the playing state on click', () => {
    cy.get('#exercise-play').click();
    cy.get('#exercise-play').should('have.class', 'is-playing');
  });

  it('Rolling a new seed updates the seed input', () => {
    cy.get('#generator-seed').invoke('val').then((before) => {
      cy.get('#generator-reroll').click();
      cy.get('#generator-seed').invoke('val').should('not.equal', before);
    });
  });

  it('Changing the progression triggers a re-render', () => {
    // The sheet container should remain present and the panel should still
    // be visible after switching the dropdown. (We can't easily assert the
    // SVG re-rendered since OSMD loads from a CDN that may be slow in CI.)
    cy.get('#generator-progression').select('12-bar-blues');
    cy.get('#generator-panel').should('not.have.attr', 'hidden');
  });
});
