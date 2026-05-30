describe('Learn view — exercise flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('.sidebar-link[data-view="learn"]', { timeout: 8000 }).click();
    cy.get('#view-learn').should('not.have.class', 'hidden');
  });

  it('shows the Continue card pointing to the first incomplete module', () => {
    cy.get('#learn-continue').should('be.visible');
    cy.get('#learn-continue-title').should('contain', 'The Major Scale');
  });

  it('shows progress at 0% with a streak of 0', () => {
    cy.get('#learn-progress-pct').should('have.text', '0%');
    cy.get('#learn-streak-current').should('have.text', '0');
  });

  it('renders module cards grouped by category', () => {
    cy.get('.learn-group-heading').should('exist');
    cy.get('.learn-card').its('length').should('be.greaterThan', 10);
  });

  it('Resume opens the exercise overlay on the first step', () => {
    cy.get('#learn-continue-btn').click();
    cy.get('#learn-exercise-overlay').should('not.have.class', 'hidden');
    cy.get('#exercise-module-name').should('contain', 'The Major Scale');
    cy.get('.exercise-step-rail-item.current').should('have.length', 1);
    cy.get('.exercise-step-rail-item').eq(0).should('have.class', 'current');
  });

  it('Next advances to the second step and updates the rail indicator', () => {
    cy.get('#learn-continue-btn').click();
    cy.get('.exercise-step-rail-item').eq(0).should('have.class', 'current');
    cy.get('#exercise-next').click();
    // Step rail animates; allow a moment for the slide transition
    cy.get('.exercise-step-rail-item').eq(0).should('have.class', 'done');
    cy.get('.exercise-step-rail-item').eq(1).should('have.class', 'current');
  });

  it('Back returns to the previous step', () => {
    cy.get('#learn-continue-btn').click();
    cy.get('#exercise-next').click();
    cy.get('.exercise-step-rail-item').eq(1).should('have.class', 'current');
    cy.get('#exercise-back-arrow').click();
    cy.get('.exercise-step-rail-item').eq(0).should('have.class', 'current');
  });

  it('Lesson map opens with all groups', () => {
    cy.get('#learn-map-btn').click();
    cy.get('#learn-map-overlay').should('not.have.class', 'hidden');
    cy.get('.learn-map-group').its('length').should('be.greaterThan', 4);
  });

  it('Closes overlays with the close button', () => {
    cy.get('#learn-continue-btn').click();
    cy.get('#exercise-close').click();
    cy.get('#learn-exercise-overlay').should('have.class', 'hidden');
  });

  it('Transposes the exercise with the Key stepper', () => {
    cy.get('#learn-continue-btn').click();
    cy.get('#exercise-next').click(); // advance to first exercise step
    // Adjust controls live inside a <details> that is collapsed by default
    cy.get('#exercise-controls-disclosure > summary').click();
    cy.get('#exercise-key-label').invoke('text').then((before) => {
      cy.get('#exercise-transpose-up').click();
      cy.get('#exercise-key-label').invoke('text').should('not.equal', before);
    });
  });

  it('Tempo slider updates the tempo display', () => {
    cy.get('#learn-continue-btn').click();
    cy.get('#exercise-next').click();
    cy.get('#exercise-controls-disclosure > summary').click();
    cy.get('#exercise-tempo').invoke('val', 140).trigger('input');
    cy.get('#exercise-tempo-display').should('have.text', '140');
  });

  it('Counterpoint group is listed and opens its first module', () => {
    cy.get('.learn-card[data-id="counterpoint-species-1"]', { timeout: 8000 })
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('#learn-exercise-overlay').should('not.have.class', 'hidden');
    // Title can be EN or a localised variant — match by regex.
    cy.get('#exercise-title').invoke('text').should('match', /Note against note|Nota contra nota/);
    // Module has 5 steps (1 theory + 4 exercises).
    cy.get('.exercise-step-rail-item').should('have.length', 5);
  });

  it('Major scale ships method-book pattern exercises (pairs + threes)', () => {
    cy.get('.learn-card[data-id="major-scale"]', { timeout: 8000 })
      .scrollIntoView()
      .click();
    cy.get('#learn-exercise-overlay').should('not.have.class', 'hidden');
    // 1 theory + 9 exercises = 10 steps total.
    cy.get('.exercise-step-rail-item').should('have.length', 10);
  });
});
