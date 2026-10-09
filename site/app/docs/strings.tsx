import strings from './ui-strings.json';

const { en, de, fr } = strings as Record<
  'en' | 'de' | 'fr',
  Record<string, string>
>;

export function StringTable() {
  return (
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>English</th>
          <th>German</th>
          <th>French</th>
        </tr>
      </thead>
      <tbody>
        {Object.keys(en)
          .sort()
          .map(key => (
            <tr key={key}>
              <td>
                <code>{key}</code>
              </td>
              <td>{en[key]}</td>
              <td>{de[key]}</td>
              <td>{fr[key]}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
