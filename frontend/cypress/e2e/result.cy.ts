describe('Result page', () => {

  beforeEach(() => {
    cy.intercept('GET', '/api/results/test-uuid-001', {
      fixture: 'extraction-result.json'
    }).as('getResult');

    cy.visit('/result/test-uuid-001');
    cy.wait('@getResult');
  });

  // ─── Rendering ────────────────────────────────────────────────────────────

  describe('Page rendering', () => {
    it('renders the file name', () => {
      cy.contains('test-cv.pdf').should('be.visible');
    });

    it('renders the document type label', () => {
      cy.contains('CV / Resume').should('be.visible');
    });

    it('renders the completed status badge', () => {
      cy.contains('completed').should('be.visible');
    });

    it('renders the page count', () => {
      cy.contains('1 page').should('be.visible');
    });

    it('renders the fields extracted count', () => {
      cy.contains('4').should('be.visible');
    });
  });

  // ─── Extracted fields ─────────────────────────────────────────────────────

  describe('Extracted fields', () => {
    it('renders the Extracted Fields heading', () => {
      cy.contains('Extracted Fields').should('be.visible');
    });

    it('renders field cards for each extracted field', () => {
      cy.contains('Name').should('be.visible');
      cy.contains('Mahlatse Madiseng').should('be.visible');
    });

    it('renders confidence badges on field cards', () => {
      cy.contains('95%').should('be.visible');
    });

    it('renders all four extracted fields', () => {
      cy.contains('Name').should('exist');
      cy.contains('Email').should('exist');
      cy.contains('Phone').should('exist');
      cy.contains('Skills').should('exist');
    });
  });

  // ─── Raw JSON toggle ──────────────────────────────────────────────────────

  describe('Raw JSON toggle', () => {
    it('raw JSON is hidden by default', () => {
      cy.get('pre').should('not.exist');
    });

    it('shows raw JSON when toggle is clicked', () => {
      cy.contains('Show Raw JSON').click();
      cy.get('pre').should('be.visible');
    });

    it('hides raw JSON when toggled off', () => {
      cy.contains('Show Raw JSON').click();
      cy.get('pre').should('be.visible');
      cy.contains('Hide Raw JSON').click();
      cy.get('pre').should('not.exist');
    });
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  describe('Navigation', () => {
    it('Back to History link navigates to history', () => {
      cy.contains('Back to History').click();
      cy.url().should('include', '/history');
    });

    it('Analyse Another Document link navigates to upload', () => {
      cy.contains('Analyse Another Document').click();
      cy.url().should('include', '/upload');
    });
  });

});