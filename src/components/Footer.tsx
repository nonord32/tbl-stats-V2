// src/components/Footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          &copy; {new Date().getFullYear()}{' '}
          <a href="https://teamboxingleague.com" target="_blank" rel="noopener noreferrer">
            Team Boxing League
          </a>
          {' '}·{' '}
          <a href="https://instagram.com/teamboxingleague" target="_blank" rel="noopener noreferrer">
            @teamboxingleague
          </a>
          {' '}·{' '}
          <Link href="/">TBLStats.com</Link>
        </p>
      </div>
    </footer>
  );
}
