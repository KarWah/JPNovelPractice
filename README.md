<details open>
<summary>Click to view</summary>

<br>

<h1 align="center">JPNovel Practice</h1>

<p align="center">
  <em>A context-driven Japanese reading tool and spaced repetition system (SRS) for vocabulary acquisition.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Live-seishun.koze.dev-brightgreen?style=for-the-badge" alt="Live Demo" />
  <img src="https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
</p>

<!-- 
🖼️ SCREENSHOT/DEMO PLACEHOLDER 
Add an image or GIF here showcasing the reader or test interface:
![JPNovel Reader](link/to/reader-demo.gif)
-->

## ✨ Key Features
- **Novel Import & Parsing:** Users can import Japanese texts, which are processed for vocabulary extraction and in-context learning.
- **Contextual Learning:** Learn vocabulary within the actual sentences they appeared in.
- **Spaced Repetition System (SRS):** Built-in algorithmic scheduling for vocabulary reviews to optimize long-term retention.
- **AI Chat Assistant:** Integrated AI helper to provide detailed nuances, grammar explanations, and context-aware definitions during tests.
- **Secure Authentication:** Custom email/password authentication using bcryptjs and secure session handling.

## 🛠️ Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes / Server Actions
- **Database:** PostgreSQL, Prisma ORM
- **AI/ML:** Integrated LLM API for real-time vocabulary lookups
- **Security:** bcryptjs
- **Deployment:** Live at [seishun.koze.dev](https://seishun.koze.dev)

## 🏗️ Architecture Overview

The app is built as a full-stack Next.js application taking advantage of Server Components and Server Actions. When a text is imported, the backend parses it into sentences and words, storing the relations in PostgreSQL via Prisma. The review system queries the database based on SRS algorithms to serve due items to the user. AI lookups are streamed directly from the backend to the frontend to assist users in real-time.

```text
[ Client (Browser) ]
        |
 (Next.js Frontend / UI)
        |
 [ Next.js API / Server Actions ] <---> [ AI API (Contextual lookups) ]
        |
  [ Prisma ORM ]
        |
 [ PostgreSQL ] (Users, Books, Vocab, SRS Data)
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/KarWah/JPNovelPractice.git
   cd JPNovelPractice
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Environment Variables:
   Create a `.env` file:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/jpnovel"
   OPENAI_API_KEY="your-key"
   SESSION_SECRET="your-secret"
   ```
4. Initialize the Database:
   ```bash
   npx prisma migrate dev
   ```

### Running Locally
1. Start the Next.js development server:
   ```bash
   npm run dev
   ```
2. Access the app at `http://localhost:3000`.

## 📁 Project Structure
- `/app` - Next.js App Router pages and API routes.
- `/components` - UI components (Reader, Flashcards, Chat).
- `/lib/srs` - Logic for the spaced repetition algorithm.
- `/lib/parser` - Japanese text parsing and tokenization logic.
- `/prisma` - Database schema and migrations.

## 📄 License
This project is licensed under the MIT License.

</details>
