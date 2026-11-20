import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, RefreshCw, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface QrScannerModalProps {
  visible: boolean;
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  onScan: (valor: string) => void;
}

export function QrScannerModal({
  visible,
  titulo,
  subtitulo,
  onClose,
  onScan,
}: QrScannerModalProps) {
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [cameraPronta, setCameraPronta] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const jaLeuRef = useRef(false);

  useEffect(() => {
    if (visible) {
      jaLeuRef.current = false;
      setCameraPronta(false);
      setErroCamera(null);
      if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) {
        requestPermission();
      }
    }
  }, [visible, permission?.granted]);

  if (!visible) return null;

  function handleBarcodeScanned({ data }: { data: string }) {
    if (jaLeuRef.current || !data) return;
    jaLeuRef.current = true;
    onScan(data.trim());
    onClose();
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Barra superior */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{titulo}</Text>
          {subtitulo ? <Text style={styles.subtitle}>{subtitulo}</Text> : null}
        </View>

        {Platform.OS !== 'web' && permission?.granted ? (
          <Pressable
            style={styles.headerBtn}
            onPress={() => {
              setCameraPronta(false);
              setFacing((atual) => (atual === 'back' ? 'front' : 'back'));
            }}
          >
            <RefreshCw size={17} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <Pressable style={styles.headerBtn} onPress={onClose}>
          <X size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.fallbackBox}>
          <Camera size={40} color="#C94A29" />
          <Text style={styles.fallbackTitle}>Leitor disponível no celular</Text>
          <Text style={styles.fallbackDesc}>
            Para escanear QR Codes com a câmera, abra o Lara Pont no celular (Expo Go ou app instalado). No computador, digite o código normalmente.
          </Text>
          <Pressable style={styles.actionBtn} onPress={onClose}>
            <Text style={styles.actionBtnText}>Voltar e digitar</Text>
          </Pressable>
        </View>
      ) : !permission ? (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackDesc}>Verificando permissão da câmera...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.fallbackBox}>
          <Camera size={40} color="#C94A29" />
          <Text style={styles.fallbackTitle}>Permissão de câmera necessária</Text>
          <Text style={styles.fallbackDesc}>
            {permission.canAskAgain
              ? 'Toque no botão abaixo para liberar a câmera.'
              : 'A câmera está bloqueada para o Expo Go nos Ajustes do iPhone. Libere nas configurações.'}
          </Text>
          <Pressable
            style={styles.actionBtn}
            onPress={() =>
              permission.canAskAgain ? requestPermission() : Linking.openSettings()
            }
          >
            <Text style={styles.actionBtnText}>
              {permission.canAskAgain ? 'Permitir câmera' : 'Abrir Ajustes'}
            </Text>
          </Pressable>
        </View>
      ) : erroCamera ? (
        <View style={styles.fallbackBox}>
          <Camera size={40} color="#C94A29" />
          <Text style={styles.fallbackTitle}>Erro ao abrir câmera</Text>
          <Text style={styles.fallbackDesc}>{erroCamera}</Text>
          <Pressable style={styles.actionBtn} onPress={onClose}>
            <Text style={styles.actionBtnText}>Voltar e digitar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={{ width, height: Math.max(height - 110, 400) }}
            facing={facing}
            active={true}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onCameraReady={() => setCameraPronta(true)}
            onMountError={(e) => setErroCamera(e.message || 'Falha ao montar câmera.')}
            onBarcodeScanned={handleBarcodeScanned}
          />

          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.hint}>
              {cameraPronta
                ? 'Aponte para o QR Code'
                : 'Iniciando câmera... (tente o botão girar acima se demorar)'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#141414',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#141414',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#A3A199', fontSize: 12, marginTop: 2 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#C94A29',
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(20,20,20,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    maxWidth: '85%',
  },
  fallbackBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackDesc: {
    color: '#A3A199',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    maxWidth: 360,
  },
  actionBtn: {
    backgroundColor: '#C94A29',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 10,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});