import { describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { SectionTitle } from './SectionTitle';

// Same one-time flag app-state.test.tsx and Pill.test.tsx set — react's
// `act` warns without it and there is no DOM/RN test environment here to set
// it implicitly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SectionTitle', () => {
  it('renders the required title', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SectionTitle title="मेरो स्वास्थ्य चित्र" />);
    });
    expect(tree.root.findByProps({ children: 'मेरो स्वास्थ्य चित्र' })).toBeTruthy();
  });

  it('omits the eyebrow and body when neither is passed', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SectionTitle title="Only a title" />);
    });
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
  });

  it('renders an eyebrow and body when both are passed', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SectionTitle eyebrow="PATIENT-CONTROLLED" title="Title" body="Supporting copy" />,
      );
    });
    expect(tree.root.findByProps({ children: 'PATIENT-CONTROLLED' })).toBeTruthy();
    expect(tree.root.findByProps({ children: 'Supporting copy' })).toBeTruthy();
  });
});
