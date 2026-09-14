# Re-identification interface scaffolding tests -- docs/backend.md §12.5. Confirms the
# plumbing (extract -> compare) works correctly; does NOT test real appearance
# matching, since MockReIdentificationProvider deliberately carries no real appearance
# information (see its docstring). Nothing in the actual pipeline calls this yet.
import numpy as np
import pytest


def test_mock_reid_provider_embedding_shape():
    from ai.mock_providers import MockReIdentificationProvider

    provider = MockReIdentificationProvider()
    crop = np.zeros((100, 50, 3), dtype=np.uint8)  # height=100, width=50
    embedding = provider.extract_embedding(crop)
    assert len(embedding) == provider._EMBEDDING_DIM
    assert embedding[0] == 100.0
    assert embedding[1] == 50.0


def test_mock_reid_provider_identical_crops_score_high_similarity():
    from ai.mock_providers import MockReIdentificationProvider

    provider = MockReIdentificationProvider()
    crop = np.zeros((100, 50, 3), dtype=np.uint8)
    embedding_a = provider.extract_embedding(crop)
    embedding_b = provider.extract_embedding(crop)
    assert provider.similarity(embedding_a, embedding_b) == 1.0  # identical vectors


def test_mock_reid_provider_similarity_handles_empty_input():
    from ai.mock_providers import MockReIdentificationProvider

    provider = MockReIdentificationProvider()
    assert provider.similarity([], []) == 0.0
    assert provider.similarity([1.0], [1.0, 2.0]) == 0.0  # mismatched length


# --- ai/classical_reid_provider.py -- docs/backend.md §12.7 -------------------------
# Unlike the mock above, this provider actually looks at pixel content (an HSV color
# histogram, via real OpenCV calls) -- these tests prove that with crops that are the
# SAME size but DIFFERENT colors, which the dimension-only mock can't distinguish at
# all (see test_classical_reid_differs_from_mock_on_same_dimensions below).


def _solid_color_crop(bgr, height=60, width=40):
    import numpy as np

    crop = np.zeros((height, width, 3), dtype=np.uint8)
    crop[:, :] = bgr
    return crop


def test_classical_reid_identical_crops_score_near_one():
    from ai.classical_reid_provider import ColorHistogramReIdentificationProvider

    provider = ColorHistogramReIdentificationProvider()
    crop = _solid_color_crop(bgr=(0, 0, 200))  # a red-ish crop
    embedding_a = provider.extract_embedding(crop)
    embedding_b = provider.extract_embedding(crop)
    assert provider.similarity(embedding_a, embedding_b) > 0.999


def test_classical_reid_different_colors_score_lower_than_identical():
    """The actual proof this is real, not fabricated: two visually different crops
    must score meaningfully lower than two identical ones."""
    from ai.classical_reid_provider import ColorHistogramReIdentificationProvider

    provider = ColorHistogramReIdentificationProvider()
    red_crop = _solid_color_crop(bgr=(0, 0, 200))
    blue_crop = _solid_color_crop(bgr=(200, 0, 0))

    red_embedding = provider.extract_embedding(red_crop)
    blue_embedding = provider.extract_embedding(blue_crop)
    other_red_embedding = provider.extract_embedding(red_crop)

    cross_color_similarity = provider.similarity(red_embedding, blue_embedding)
    same_color_similarity = provider.similarity(red_embedding, other_red_embedding)

    assert same_color_similarity > cross_color_similarity
    assert cross_color_similarity < 0.5  # solid red vs. solid blue share almost no histogram mass


def test_classical_reid_differs_from_mock_on_same_dimensions_different_colors():
    """Demonstrates the actual improvement over MockReIdentificationProvider: same
    crop *size*, different *content* -- the mock can't tell these apart (it only
    looks at height/width), the classical provider can (it looks at pixels)."""
    from ai.mock_providers import MockReIdentificationProvider
    from ai.classical_reid_provider import ColorHistogramReIdentificationProvider

    red_crop = _solid_color_crop(bgr=(0, 0, 200))
    blue_crop = _solid_color_crop(bgr=(200, 0, 0))  # same height/width as red_crop

    mock = MockReIdentificationProvider()
    mock_similarity = mock.similarity(mock.extract_embedding(red_crop), mock.extract_embedding(blue_crop))
    # Cosine similarity of two identical vectors can land at 1.0000000000000002 due to
    # float rounding in the norm division -- pytest.approx handles that; the point being
    # tested is that it's ~1.0 (blind to color), not exactly float-bit-for-bit 1.0.
    assert mock_similarity == pytest.approx(1.0)  # blind to color entirely -- same dimensions look "identical"

    classical = ColorHistogramReIdentificationProvider()
    classical_similarity = classical.similarity(
        classical.extract_embedding(red_crop), classical.extract_embedding(blue_crop)
    )
    assert classical_similarity < mock_similarity  # the classical provider actually notices


def test_classical_reid_handles_empty_crop():
    import numpy as np
    from ai.classical_reid_provider import ColorHistogramReIdentificationProvider

    provider = ColorHistogramReIdentificationProvider()
    empty_crop = np.zeros((0, 0, 3), dtype=np.uint8)
    embedding = provider.extract_embedding(empty_crop)
    assert all(v == 0.0 for v in embedding)
    # Two flat/all-zero histograms carry no real color signal -- must not report a
    # perfect match just because cv2's correlation formula treats constant inputs as
    # "identical" by convention. See similarity()'s comment in classical_reid_provider.py.
    assert provider.similarity(embedding, embedding) == 0.0
