package com.pablohorcajada.tablet;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "AssistantVoice",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class AssistantVoicePlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private PluginCall activeCall;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("El permiso de micrófono no está concedido.");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("El reconocimiento de voz no está disponible.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            cancelActiveCall("Se ha sustituido el dictado anterior.");
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);
            activeCall = call;
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "es-ES"));
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            recognizer.startListening(intent);
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            cancelActiveCall("Dictado cancelado.");
            call.resolve();
        });
    }

    @Override
    public void onResults(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        PluginCall call = activeCall;
        activeCall = null;
        destroyRecognizer();
        if (call == null) return;
        JSObject result = new JSObject();
        result.put("text", matches == null || matches.isEmpty() ? "" : matches.get(0));
        call.resolve(result);
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        JSObject event = new JSObject();
        event.put("text", matches.get(0));
        notifyListeners("partialResult", event);
    }

    @Override
    public void onError(int error) {
        PluginCall call = activeCall;
        activeCall = null;
        destroyRecognizer();
        if (call != null) call.reject(recognitionError(error));
    }

    private void cancelActiveCall(String message) {
        PluginCall call = activeCall;
        activeCall = null;
        if (recognizer != null) recognizer.cancel();
        destroyRecognizer();
        if (call != null) call.reject(message);
    }

    private void destroyRecognizer() {
        if (recognizer == null) return;
        recognizer.destroy();
        recognizer = null;
    }

    private String recognitionError(int error) {
        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) return "No se ha detectado voz.";
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) return "Android no ha concedido permiso para utilizar el micrófono.";
        if (error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) return "El servicio de voz necesita conexión en este dispositivo.";
        if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) return "El reconocimiento de voz está ocupado. Prueba de nuevo.";
        return "No se ha podido reconocer la voz (código " + error + ").";
    }

    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onEvent(int eventType, Bundle params) {}

    @Override
    protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> cancelActiveCall("La aplicación se ha cerrado."));
        super.handleOnDestroy();
    }
}
