import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Image as ImageIcon, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { createWorker } from "tesseract.js";

const ScanPrescription = () => {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCamera, setIsCamera] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCamera(true);
      }
    } catch (error) {
      toast.error("Failed to access camera");
      console.error(error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg");
        setImage(imageData);
        stopCamera();
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const sanitizeOCRText = (text: string): string => {
    // Limit length and remove potentially harmful characters
    return text
      .slice(0, 1000) // Limit total text length
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  };

  const processImage = async () => {
    if (!image) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(image);
      const sanitizedText = sanitizeOCRText(text);
      setExtractedText(sanitizedText);
      
      await worker.terminate();

      toast.success("Prescription scanned successfully!");
      toast.info("Please review the extracted information carefully before saving.");
      
      // Parse the text and navigate to add medication with pre-filled data
      setTimeout(() => {
        navigate("/add-medication", { state: { scannedText: sanitizedText } });
      }, 1000);
    } catch (error) {
      toast.error("Failed to process image");
      console.error(error);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Scan Prescription</h1>
            <p className="text-muted-foreground">Capture or upload a prescription image</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Capture Prescription</CardTitle>
            <CardDescription>
              Use your camera or upload an image for automatic text recognition
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!image && !isCamera && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-32 flex flex-col gap-2"
                  onClick={startCamera}
                >
                  <Camera className="w-8 h-8" />
                  <span>Use Camera</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-32 flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-8 h-8" />
                  <span>Upload Image</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {isCamera && (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg border border-border"
                />
                <div className="flex gap-4">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {image && !isCamera && (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={image}
                    alt="Prescription"
                    className="w-full rounded-lg border border-border"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                      <p className="text-sm font-medium">Processing image...</p>
                      <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={processImage}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Scan & Extract Text"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImage(null);
                      setExtractedText("");
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                {extractedText && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Extracted Text</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg">
                        {extractedText}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Ensure good lighting when capturing the prescription</p>
            <p>• Keep the prescription flat and avoid shadows</p>
            <p>• Make sure all text is clearly visible and in focus</p>
            <p>• Review and correct any extracted information before saving</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ScanPrescription;
