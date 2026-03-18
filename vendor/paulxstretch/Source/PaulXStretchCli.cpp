// SPDX-License-Identifier: GPLv3-or-later WITH Appstore-exception

#include "PluginProcessor.h"

#include <atomic>
#include <iostream>

namespace
{
struct CliRenderRequest
{
    File inputFile;
    File outputFile;
    String mode;
    double stretchAmount = 2.0;
    double fftSizeNormalized = 0.7;
    double pitchShiftSemitones = 0.0;
    double frequencySpread = 0.0;
    double playRangeStart = 0.0;
    double playRangeEnd = 1.0;
    double maxOutputDurationSec = 120.0;
    double outputSampleRate = 0.0;
};

bool isNumericVar(const var& value)
{
    return value.isInt() || value.isInt64() || value.isDouble();
}

double numericVarToDouble(const var& value)
{
    if (value.isInt())
        return static_cast<double>(static_cast<int>(value));

    if (value.isInt64())
        return static_cast<double>(static_cast<int64>(value));

    return static_cast<double>(value);
}

var makeObject(std::initializer_list<std::pair<const char*, var>> values)
{
    auto* object = new DynamicObject();

    for (const auto& [key, value] : values)
        object->setProperty(key, value);

    return var(object);
}

void printJson(const var& payload)
{
    std::cout << JSON::toString(payload, true).toStdString() << std::endl;
}

void printError(const String& message)
{
    printJson(makeObject({
        {"type", "error"},
        {"error", message},
    }));
}

Result requireString(const DynamicObject& object, const Identifier& property, String& destination)
{
    const auto value = object.getProperty(property);

    if (!value.isString() || value.toString().isEmpty())
        return Result::fail("Missing or invalid string property: " + property.toString());

    destination = value.toString();
    return Result::ok();
}

Result requireNumber(const DynamicObject& object, const Identifier& property, double& destination)
{
    const auto value = object.getProperty(property);

    if (!isNumericVar(value))
        return Result::fail("Missing or invalid numeric property: " + property.toString());

    destination = numericVarToDouble(value);
    return Result::ok();
}

Result parseOutputSampleRate(const DynamicObject& object, double& destination)
{
    const auto value = object.getProperty("outputSampleRate");

    if (value.isString())
    {
        const auto text = value.toString();

        if (text == "source")
        {
            destination = 0.0;
            return Result::ok();
        }

        return Result::fail("outputSampleRate must be \"source\", 44100, or 48000");
    }

    if (!isNumericVar(value))
        return Result::fail("Missing or invalid outputSampleRate");

    const auto number = numericVarToDouble(value);

    if (number != 44100.0 && number != 48000.0)
        return Result::fail("outputSampleRate must be \"source\", 44100, or 48000");

    destination = number;
    return Result::ok();
}

Result parseRenderRequestFile(const File& requestFile, CliRenderRequest& destination)
{
    if (!requestFile.existsAsFile())
        return Result::fail("Request file does not exist: " + requestFile.getFullPathName());

    var parsed;
    const auto parseResult = JSON::parse(requestFile.loadFileAsString(), parsed);

    if (parseResult.failed())
        return Result::fail("Could not parse render request JSON: " + parseResult.getErrorMessage());

    const auto* object = parsed.getDynamicObject();

    if (object == nullptr)
        return Result::fail("Render request must be a JSON object");

    String inputPath;
    String outputPath;

    if (auto result = requireString(*object, "inputPath", inputPath); result.failed())
        return result;

    if (auto result = requireString(*object, "outputPath", outputPath); result.failed())
        return result;

    if (auto result = requireString(*object, "mode", destination.mode); result.failed())
        return result;

    if (destination.mode != "preview" && destination.mode != "export")
        return Result::fail("mode must be either \"preview\" or \"export\"");

    if (auto result = requireNumber(*object, "stretchAmount", destination.stretchAmount); result.failed())
        return result;

    if (auto result = requireNumber(*object, "fftSizeNormalized", destination.fftSizeNormalized); result.failed())
        return result;

    if (auto result = requireNumber(*object, "pitchShiftSemitones", destination.pitchShiftSemitones); result.failed())
        return result;

    if (auto result = requireNumber(*object, "frequencySpread", destination.frequencySpread); result.failed())
        return result;

    if (auto result = requireNumber(*object, "playRangeStart", destination.playRangeStart); result.failed())
        return result;

    if (auto result = requireNumber(*object, "playRangeEnd", destination.playRangeEnd); result.failed())
        return result;

    if (auto result = requireNumber(*object, "maxOutputDurationSec", destination.maxOutputDurationSec); result.failed())
        return result;

    if (auto result = parseOutputSampleRate(*object, destination.outputSampleRate); result.failed())
        return result;

    destination.inputFile = File(inputPath);
    destination.outputFile = File(outputPath);

    destination.stretchAmount = jlimit(0.1, 1024.0, destination.stretchAmount);
    destination.fftSizeNormalized = jlimit(0.0, 1.0, destination.fftSizeNormalized);
    destination.pitchShiftSemitones = jlimit(-24.0, 24.0, destination.pitchShiftSemitones);
    destination.frequencySpread = jlimit(0.0, 1.0, destination.frequencySpread);
    destination.playRangeStart = jlimit(0.0, 1.0, destination.playRangeStart);
    destination.playRangeEnd = jlimit(destination.playRangeStart + 0.0001, 1.0, destination.playRangeEnd);
    destination.maxOutputDurationSec = jlimit(5.0, 600.0, destination.maxOutputDurationSec);

    return Result::ok();
}

Result inspectFile(const File& inputFile)
{
    if (!inputFile.existsAsFile())
    {
        printJson(makeObject({
            {"ok", false},
            {"inputPath", inputFile.getFullPathName()},
            {"error", "Input file does not exist"},
        }));
        return Result::fail("Input file does not exist");
    }

    AudioFormatManager manager;
    manager.registerBasicFormats();

    auto reader = std::unique_ptr<AudioFormatReader>(manager.createReaderFor(inputFile));

    if (reader == nullptr)
    {
        printJson(makeObject({
            {"ok", false},
            {"inputPath", inputFile.getFullPathName()},
            {"error", "Could not open audio file"},
        }));
        return Result::fail("Could not open audio file");
    }

    if (reader->numChannels > 8)
    {
        printJson(makeObject({
            {"ok", false},
            {"inputPath", inputFile.getFullPathName()},
            {"error", "Too many channels in file " + inputFile.getFullPathName()},
        }));
        return Result::fail("Too many channels");
    }

    if (reader->bitsPerSample > 32)
    {
        printJson(makeObject({
            {"ok", false},
            {"inputPath", inputFile.getFullPathName()},
            {"error", "Too high bit depth in file " + inputFile.getFullPathName()},
        }));
        return Result::fail("Too high bit depth");
    }

    const auto durationSeconds =
        reader->sampleRate > 0.0 ? static_cast<double>(reader->lengthInSamples) / reader->sampleRate : 0.0;

    printJson(makeObject({
        {"ok", true},
        {"inputPath", inputFile.getFullPathName()},
        {"formatName", reader->getFormatName()},
        {"sampleRate", reader->sampleRate},
        {"durationSec", durationSeconds},
        {"channels", static_cast<int>(reader->numChannels)},
        {"bitsPerSample", static_cast<int>(reader->bitsPerSample)},
    }));

    return Result::ok();
}

Result applyRenderRequest(PaulstretchpluginAudioProcessor& processor, const CliRenderRequest& request)
{
    if (!request.inputFile.existsAsFile())
        return Result::fail("Input file does not exist: " + request.inputFile.getFullPathName());

    auto loadError = processor.setAudioFile(URL(request.inputFile));

    if (loadError.isNotEmpty())
        return Result::fail(loadError);

    *processor.getFloatParameter(cpi_stretchamount) = static_cast<float>(request.stretchAmount);
    *processor.getFloatParameter(cpi_fftsize) = static_cast<float>(request.fftSizeNormalized);
    *processor.getFloatParameter(cpi_pitchshift) = static_cast<float>(request.pitchShiftSemitones);
    *processor.getFloatParameter(cpi_spreadamount) = static_cast<float>(request.frequencySpread);
    *processor.getFloatParameter(cpi_soundstart) = static_cast<float>(request.playRangeStart);
    *processor.getFloatParameter(cpi_soundend) = static_cast<float>(request.playRangeEnd);
    *processor.getBoolParameter(cpi_enable_spec_module3) = true;
    *processor.getBoolParameter(cpi_enable_spec_module5) = request.frequencySpread > 0.0;
    *processor.getIntParameter(cpi_num_outchans) = 2;

    return Result::ok();
}

int runRender(const File& requestFile)
{
    CliRenderRequest request;

    if (auto result = parseRenderRequestFile(requestFile, request); result.failed())
    {
        printError(result.getErrorMessage());
        return 1;
    }

    request.outputFile.getParentDirectory().createDirectory();

    ScopedJuceInitialiser_GUI scopedJuce;
    PaulstretchpluginAudioProcessor processor(true);

    if (auto result = applyRenderRequest(processor, request); result.failed())
    {
        printError(result.getErrorMessage());
        return 1;
    }

    WaitableEvent doneEvent;
    std::atomic<bool> succeeded{ false };
    File completedFile;

    const auto outputFormat = request.mode == "preview" ? 0 : 1;

    auto status = processor.offlineRender(OfflineRenderParams(
        request.outputFile,
        request.outputSampleRate,
        outputFormat,
        request.maxOutputDurationSec,
        1,
        nullptr,
        [&doneEvent, &succeeded, &completedFile](bool ok, File file)
        {
            succeeded.store(ok);
            completedFile = file;
            doneEvent.signal();
        }));

    if (!status.containsIgnoreCase("Rendered"))
    {
        printError(status);
        return 1;
    }

    printJson(makeObject({
        {"type", "started"},
        {"outputPath", request.outputFile.getFullPathName()},
    }));

    auto lastProgress = -1;

    while (!doneEvent.wait(250))
    {
        const auto progress = processor.m_offline_render_state.load();

        if (progress >= 0 && progress <= 100 && progress != lastProgress)
        {
            lastProgress = progress;
            printJson(makeObject({
                {"type", "progress"},
                {"percent", progress},
            }));
        }
    }

    if (!succeeded.load())
    {
        printError("Render failed");
        return 1;
    }

    printJson(makeObject({
        {"type", "complete"},
        {"outputPath", completedFile.getFullPathName()},
    }));

    return 0;
}

String findOptionValue(const StringArray& args, const String& option)
{
    const auto index = args.indexOf(option);

    if (index < 0 || index + 1 >= args.size())
        return {};

    return args[index + 1];
}
} // namespace

int main(int argc, char* argv[])
{
    const StringArray args(argv, argc);

    if (args.size() < 2)
    {
        std::cerr << "Usage: PaulXStretchCli inspect --input <file> --json | render --request <file>" << std::endl;
        return 1;
    }

    const auto command = args[1];

    if (command == "inspect")
    {
        const auto inputPath = findOptionValue(args, "--input");

        if (inputPath.isEmpty())
        {
            std::cerr << "--input is required for inspect" << std::endl;
            return 1;
        }

        return inspectFile(File(inputPath)).wasOk() ? 0 : 1;
    }

    if (command == "render")
    {
        const auto requestPath = findOptionValue(args, "--request");

        if (requestPath.isEmpty())
        {
            std::cerr << "--request is required for render" << std::endl;
            return 1;
        }

        return runRender(File(requestPath));
    }

    std::cerr << "Unknown command: " << command << std::endl;
    return 1;
}
