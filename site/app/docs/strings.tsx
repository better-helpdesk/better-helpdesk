import strings from './ui-strings.json';

const { en, de, fr, it } = strings as Record<
  'en' | 'de' | 'fr' | 'it',
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
          <th>Italian</th>
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
              <td>{it[key]}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
