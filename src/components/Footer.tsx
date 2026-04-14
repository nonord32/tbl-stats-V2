// src/components/Footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          &copy; {new Date().getFullYear()}{' '}
          <a href="https://www.teamboxingleague.com/" target="_blank" rel="noopener noreferrer">
            Team Boxing League
          </a>
          {' '}·{' '}
          <a href="https://www.instagram.com/teamboxingleague/" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          {' '}·{' '}
          <a href="https://www.youtube.com/@teamboxingleague" target="_blank" rel="noopener noreferrer">
            YouTube
          </a>
        </p>
      </div>
    </footer>
  );
}
