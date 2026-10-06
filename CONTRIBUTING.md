# Contributing to MOV-IQ

Thank you for your interest in contributing to **MOV-IQ**! We welcome bug reports, feature suggestions, documentation enhancements, and code contributions.

## Code of Conduct
Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

1. **Fork the Repository**:
   Click the "Fork" button at the top of the repository page.

2. **Clone your Fork**:
   ```bash
   git clone https://github.com/Bhargav-kilari/MOV-IQ.git
   cd MOV-IQ
   ```

3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Install Dependencies**:
   ```bash
   npm run install:all
   ```

5. **Make Changes & Test**:
   - Ensure you follow existing formatting and architectural patterns.
   - Run verification tests:
     ```bash
     node server/test_api.js
     ```

6. **Commit & Push**:
   ```bash
   git add .
   git commit -m "feat: add your descriptive feature commit message"
   git push origin feature/your-feature-name
   ```

7. **Submit a Pull Request**:
   Open a Pull Request describing your changes clearly against the `main` branch.

## Licensing & Intellectual Property
By contributing to MOV-IQ, you agree that your contributions will be licensed under the project's [MIT License](LICENSE), and that any third-party code or datasets included adhere to their respective licenses and attribution requirements.
