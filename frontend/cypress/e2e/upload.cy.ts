describe('Upload page', () => {

  beforeEach(() => {
    cy.visit('/upload');
  });

  // ─── Rendering ────────────────────────────────────────────────────────────

  describe('Page rendering', () => {
    it('renders the page heading', () => {
      cy.contains('Document Intelligence').should('be.visible');
    });

    it('renders the step 1 label', () => {
      cy.contains('Step 1').should('exist');
    });

    it('renders the step 2 label', () => {
      cy.contains('Step 2').should('exist');
    });

    it('renders all 5 document type cards', () => {
      cy.contains('CV / Resume').should('be.visible');
      cy.contains('Invoice').should('be.visible');
      cy.contains('Receipt').should('be.visible');
      cy.contains('Certificate').should('be.visible');
      cy.contains('ID Document').should('be.visible');
    });

    it('renders the drag and drop zone', () => {
      cy.contains('Drag & drop your file here').should('be.visible');
    });

    it('renders the Analyse Document button', () => {
      cy.contains('Analyse Document').should('be.visible');
    });

    it('Analyse Document button is disabled by default', () => {
      cy.contains('Analyse Document')
        .should('be.disabled');
    });

    it('renders the History nav link', () => {
      cy.contains('History').should('be.visible');
    });
  });

  // ─── Document type selection ──────────────────────────────────────────────

  describe('Document type selection', () => {
    it('highlights the selected document type', () => {
      cy.contains('CV / Resume').click();
      cy.contains('CV / Resume')
        .parent()
        .should('have.class', 'border-primary');
    });

    it('button remains disabled after selecting type only', () => {
      cy.contains('CV / Resume').click();
      cy.contains('Analyse Document').should('be.disabled');
    });
  });

  // ─── File validation ──────────────────────────────────────────────────────

  describe('File validation', () => {
    it('rejects unsupported file types', () => {
      cy.contains('CV / Resume').click();

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('fake content'),
        fileName: 'test.txt',
        mimeType: 'text/plain',
      }, { force: true });

      cy.contains('File type not supported').should('be.visible');
    });

    it('accepts PDF files', () => {
      cy.contains('CV / Resume').click();

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('%PDF-1.4 fake pdf content'),
        fileName: 'test-cv.pdf',
        mimeType: 'application/pdf',
      }, { force: true });

      cy.contains('test-cv.pdf').should('be.visible');
      cy.contains('File type not supported').should('not.exist');
    });

    it('enables the button after selecting type and valid file', () => {
      cy.contains('CV / Resume').click();

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('%PDF-1.4 fake pdf content'),
        fileName: 'test-cv.pdf',
        mimeType: 'application/pdf',
      }, { force: true });

      cy.contains('Analyse Document').should('not.be.disabled');
    });
  });

  // ─── Upload flow (mocked) ─────────────────────────────────────────────────

  describe('Upload flow', () => {
    beforeEach(() => {
      // Mock all three API calls in the upload pipeline
      cy.intercept('POST', '/api/get-upload-url', {
        fixture: 'upload-url.json'
      }).as('getUploadUrl');

      cy.intercept('PUT', 'https://aidintelstorage.blob.core.windows.net/**', {
        statusCode: 201,
        body: '',
      }).as('blobUpload');

      cy.intercept('POST', '/api/process-document', {
        statusCode: 200,
        body: { id: 'test-uuid-001', status: 'completed' }
      }).as('processDocument');
    });

    it('shows progress bar during upload', () => {
      cy.contains('CV / Resume').click();

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('%PDF-1.4 fake content'),
        fileName: 'test-cv.pdf',
        mimeType: 'application/pdf',
      }, { force: true });

      cy.contains('Analyse Document').click();
      cy.wait('@getUploadUrl');
      cy.contains('Uploading to Azure Blob Storage').should('be.visible');
    });

    it('shows success message after upload completes', () => {
      cy.contains('CV / Resume').click();

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('%PDF-1.4 fake content'),
        fileName: 'test-cv.pdf',
        mimeType: 'application/pdf',
      }, { force: true });

      cy.contains('Analyse Document').click();

      cy.wait('@getUploadUrl');
      cy.wait('@blobUpload');
      cy.wait('@processDocument');

      cy.contains('Upload complete').should('be.visible');
    });
  });

});