import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAdminVerification } from '../hooks/useAdminVerification';
import { useT } from '../hooks/useT';

interface AdminPinModalProps {
  visible: boolean;
  onSuccess: (adminUserId: string) => void;
  onCancel: () => void;
}

export default function AdminPinModal({
  visible,
  onSuccess,
  onCancel,
}: AdminPinModalProps) {
  const { t } = useT();
  const { verify, loading, error, reset } = useAdminVerification();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setPassword('');
      reset();
    }
  }, [visible, reset]);

  const handleVerify = async () => {
    const userId = await verify(email, password);
    if (userId) {
      onSuccess(userId);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{t.adminAuthorization}</Text>
          <Text style={styles.subtitle}>{t.priceOverrideRequiresAdmin}</Text>

          <TextInput
            style={styles.input}
            placeholder={t.adminEmail}
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder={t.adminPassword}
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.verifyButtonText}>
                {loading ? t.verifying : t.authorize}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(1, 4, 9, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#1c2128',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  title: {
    color: '#f85149',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0d1117',
    color: '#e6edf3',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  errorText: {
    color: '#f85149',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8b949e',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f85149',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
