import { ButtonIcon } from './components/icons';
import { Face } from './components/mark';

export default function NotFound() {
  return (
    <main className="lost">
      <span className="lost-face">
        <Face mood="flat" fg="var(--bg)" bg="var(--mint)" />
      </span>
      <h1>Nothing here.</h1>
      <p>This page does not exist. The helpdesk does.</p>
      <a className="btn btn-p" href="/">
        Back to the start
        <ButtonIcon />
      </a>
    </main>
  );
}
