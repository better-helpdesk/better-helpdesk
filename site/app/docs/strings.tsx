import strings from './ui-strings.json';

const { en, de } = strings as Record<'en' | 'de', Record<string, string>>;

export function StringTable() {
  return (
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>English</th>
          <th>German</th>
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
            </tr>
          ))}
      </tbody>
    </table>
  );
}
