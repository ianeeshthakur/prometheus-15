# Re-identification interface scaffolding tests -- docs/backend.md §12.5. Confirms the
# plumbing (extract -> compare) works correctly; does NOT test real appearance
# matching, since MockReIdentificationProvider deliberately carries no real appearance
# information (see its docstring). Nothing in the actual pipeline calls this yet.
import numpy as np


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
