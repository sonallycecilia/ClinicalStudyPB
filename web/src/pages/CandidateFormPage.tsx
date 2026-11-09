import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CandidateForm } from '../candidates/CandidateForm';
import { useRecruitmentStudies } from '../candidates/useRecruitmentStudies';
import { useAuth } from '../auth/AuthContext';
import { candidatesApi } from '../candidates/candidatesApi';

export function CandidateFormPage() {
  const navigate = useNavigate();
  const studies = useRecruitmentStudies();
  const { request } = useAuth();
  const [params] = useSearchParams();
  const studyId = params.get('studyId');
  const listUrl = `/coordenador/candidatos${studyId ? `?${new URLSearchParams({ studyId })}` : ''}`;

  return <div className="coord-page candidate-form-page">
    <header className="coord-page-heading">
      <h1><Link to={listUrl}>Candidatos e participantes</Link> <span aria-hidden="true">&gt;</span> Cadastrar candidato</h1>
    </header>
    <section className="study-form-panel candidate-form-panel" aria-labelledby="candidate-form-title">
      <div className="study-form-heading"><h2 id="candidate-form-title">Informações do candidato</h2></div>
      <CandidateForm studies={studies} onSubmit={async (input) => {
        await candidatesApi.create(request, input);
        navigate(listUrl, { state: { candidateCreated: true } });
      }} onCancel={() => navigate(listUrl)} />
    </section>
  </div>;
}
