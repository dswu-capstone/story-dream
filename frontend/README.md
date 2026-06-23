# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Story Dream Frontend

### 설치 및 실행

1. 레포지토리 내려받기

```bash
git clone https://github.com/dswu-capstone/story-dream.git
cd story-dream
```

2. `dev` 브랜치 이동 및 최신화

```bash
git switch dev
git pull origin dev
```

3. 프론트엔드 폴더 이동

```bash
cd frontend
```

4. 패키지 설치

```bash
npm ci
```

`package-lock.json`을 기준으로 필요한 패키지가 설치됩니다.

5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 다음 주소로 접속합니다.

`http://localhost:5173`

### 주요 명령어

```bash
npm run dev
```

개발 서버를 실행합니다.

```bash
npm run build
```

배포용 파일을 빌드합니다.

```bash
npm run lint
```

코드 오류 및 문법을 검사합니다.

### 폴더 구조

```text
src/
├─ assets/
├─ components/
├─ pages/
├─ routes/
├─ api/
├─ hooks/
├─ types/
├─ utils/
├─ constants/
└─ styles/
```
