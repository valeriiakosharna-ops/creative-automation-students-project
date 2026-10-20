package com.creative.studio;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class CopyModels {
    private CopyModels() {}
    public record Brief(
        @NotBlank @Size(max=80) String title,
        @NotBlank @Size(max=2000) String description,
        @NotBlank String date,
        @Size(max=5) String time,
        @NotBlank @Size(max=80) String timeZone,
        @Size(max=120) String location,
        @Size(max=500) String url,
        @Size(max=300) String direction,
        @NotBlank @Pattern(regexp="en|uk") String sourceLanguage,
        @Size(max=80) String titleEn, @Size(max=80) String titleUk,
        @Size(max=2000) String descriptionEn, @Size(max=2000) String descriptionUk,
        @NotEmpty @Size(max=4) List<@Pattern(regexp="instagram_post|instagram_story|facebook|google_chat") String> formats,
        @NotEmpty @Size(max=2) List<@Pattern(regexp="en|uk") String> languages,
        @NotNull @Min(1) @Max(3) Integer variants,
        @NotNull @Size(min=3,max=3) List<@Pattern(regexp="#[a-fA-F0-9]{6}") String> colors
    ) {}
    public record OutputSpec(@NotBlank @Size(max=80) String id,
        @NotBlank @Pattern(regexp="instagram_post|instagram_story|facebook|google_chat") String format,
        @NotBlank @Pattern(regexp="en|uk") String language,
        @Min(1) @Max(3) int variant) {}
    public record CopyRequest(@NotNull @Valid Brief brief,@NotEmpty @Size(max=24) List<@NotNull @Valid OutputSpec> outputs, @Size(max=32) String styleGuideVersion) {}
    public record CopyOutput(String id,String headline,String subheading,String cta,String caption) {}
    public record CopyResponse(String model,String promptVersion,String styleGuideVersion,List<CopyOutput> outputs) {}
}
