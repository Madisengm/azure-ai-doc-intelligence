describe('Result page', () => {

  beforeEach(() => {
    cy.intercept('GET', '/api/results/test-uuid-001', {
      fixture: 'extraction-result.json'
    }).as('getResult');

    cy.visit('/result/test-uuid-001');
    cy.wait('@getResult');
  });

  // ─── Page rendering ────────────────────────────────────────────────────────

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

  // ─── Extracted fields ──────────────────────────────────────────────────────

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

  // ─── Raw JSON toggle ───────────────────────────────────────────────────────

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

  // ─── Find Similar ──────────────────────────────────────────────────────────

  describe('Find Similar', () => {
    it('renders the Similar Documents section', () => {
      cy.contains('Similar Documents').should('be.visible');
    });

    it('renders the Find Similar button', () => {
      cy.contains('Find Similar').should('be.visible');
    });

    it('renders placeholder text before search', () => {
      cy.contains('vector similarity search').should('be.visible');
    });

    it('shows similar documents after clicking Find Similar', () => {
      cy.intercept('GET', '/api/find-similar/test-uuid-001', {
        fixture: 'similar-results.json'
      }).as('findSimilar');

      cy.contains('Find Similar').click();
      cy.wait('@findSimilar');

      cy.contains('test-cv-2.pdf').should('be.visible');
      cy.contains('test-cv-3.pdf').should('be.visible');
    });

    it('shows similarity percentage on similar results', () => {
      cy.intercept('GET', '/api/find-similar/test-uuid-001', {
        fixture: 'similar-results.json'
      }).as('findSimilar');

      cy.contains('Find Similar').click();
      cy.wait('@findSimilar');

      cy.contains('% match').should('be.visible');
    });

    it('navigates to similar result when clicked', () => {
      cy.intercept('GET', '/api/find-similar/test-uuid-001', {
        fixture: 'similar-results.json'
      }).as('findSimilar');

      cy.intercept('GET', '/api/results/test-uuid-003', {
        fixture: 'extraction-result.json'
      }).as('getResult2');

      cy.contains('Find Similar').click();
      cy.wait('@findSimilar');
      cy.contains('test-cv-2.pdf').click();
      cy.url().should('include', '/result/test-uuid-003');
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