# Contributing to Đường An Toàn

Thank you for your interest in contributing to Đường An Toàn! We welcome contributions from everyone.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/duong-an-toan.git
   cd duong-an-toan
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment variables**:
   ```bash
   echo "GEMINI_API_KEY=your_api_key_here" > .env
   ```
5. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 💻 Development Workflow

### Running the App
```bash
npm run dev
```
Visit http://localhost:3000 to see your changes in real-time.

### Building for Production
```bash
npm run build
npm run preview
```

### Code Style
- Follow existing TypeScript and React conventions
- Use functional components with hooks
- Keep components focused and single-purpose
- Add TypeScript types for all props and function parameters

## 🌐 Adding Translations

If you're adding new UI text:

1. Add the English text to `translations/en.json`
2. Add the Vietnamese text to `translations/vi.json`
3. Use the `useTranslation` hook in your component:
   ```tsx
   import { useTranslation } from 'react-i18next';

   const MyComponent = () => {
     const { t } = useTranslation();
     return <div>{t('your.translation.key')}</div>;
   };
   ```

## 🧪 Testing Your Changes

Before submitting:
- Test both point analysis and route analysis modes
- Test with all three vehicle types (car, motorcycle, pedestrian)
- Test language switching (Vietnamese ↔ English)
- Test on both desktop and mobile viewports
- Ensure no console errors appear
- **New features to test**:
  - Verify NCHMF warnings display when available
  - Check confidence levels appear in analysis results
  - Confirm 6-hour precipitation forecast shows in InfoPanel
  - Test caching by analyzing the same location twice (second should be instant)
  - Verify dangerous segments are correctly identified on routes

## 📝 Commit Guidelines

Write clear, descriptive commit messages:

**Good examples:**
- `feat: Add elevation threshold visualization to map`
- `fix: Correct precipitation data parsing for Mekong Delta`
- `docs: Update README with deployment instructions`
- `style: Improve mobile responsiveness of InfoPanel`

**Bad examples:**
- `update`
- `fix bug`
- `changes`

### Commit Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style/formatting (no logic change)
- `refactor:` Code restructuring (no behavior change)
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## 🔍 Pull Request Process

1. **Update your branch** with the latest from main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** on GitHub

4. **Describe your changes** clearly:
   - What problem does this solve?
   - How did you test it?
   - Screenshots (if UI changes)

5. **Wait for review** - maintainers will review and may request changes

6. **Address feedback** if requested

7. **Celebrate!** 🎉 Your contribution will be merged

## 🐛 Reporting Bugs

Found a bug? Please open an issue with:

- **Clear title** describing the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Browser and OS** information
- **Console errors** if any

## 💡 Suggesting Features

Have an idea? Open an issue with:

- **Clear description** of the feature
- **Use case** - why is this useful?
- **Proposed solution** (optional)
- **Alternatives considered** (optional)

## 🌍 Geographic Data Contributions

If you're improving geographic data or AI prompts:

- **Vietnam-specific**: Keep focus on Vietnamese geography
- **Test thoroughly**: Verify with real Vietnamese locations
- **Document sources**: Cite any data sources you use

## ❓ Questions?

- Open a [Discussion](https://github.com/hungduong-projects/duong-an-toan/discussions) for general questions
- Open an [Issue](https://github.com/hungduong-projects/duong-an-toan/issues) for bugs or feature requests

## 📜 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help create a welcoming community

---

Thank you for contributing to Đường An Toàn! 🙏
